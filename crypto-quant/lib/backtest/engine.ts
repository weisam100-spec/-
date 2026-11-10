import type { StrategySignal } from "@/lib/strategies/types";
import type { BacktestConfig, BacktestResult, EquityPoint, RunBacktestInput, TradeRecord } from "./types";
import { validateBacktestConfig } from "./validate";

interface OpenPosition {
  entryTime: number;
  entryPriceRaw: number;
  entryPriceFilled: number;
  /** 剩餘未出場的數量，分批停利 TP1 觸發後會減少 */
  quantity: number;
  /** 原始進場數量，作為分批停利出場比例的計算基準，不會變動 */
  originalQuantity: number;
  /** 剩餘成本基礎 */
  costBasis: number; // quantity * entryPriceFilled + entryFee（按比例遞減）
  /** 原始成本基礎，固定不變 */
  originalCostBasis: number;
  /** 原始進場手續費，固定不變，分批出場時依數量比例分攤 */
  originalEntryFee: number;
  entryReason: string;
  paramsSnapshot: Record<string, unknown>;
  highestSinceEntry: number;
  /** 分批停利 TP1 是否已觸發 */
  tp1Filled: boolean;
}

/**
 * 回測核心引擎。
 * 防未來函數原則：第 i 根 K 棒收盤才產生訊號，訊號最早在第 i+1 根 K 棒的開盤成交；
 * 停損／停利／移動停損於進場後每一根 K 棒依當根高低價檢查是否觸發。
 * 第一版僅支援現貨多頭單一持倉模擬。
 */
export function runBacktest(input: RunBacktestInput): BacktestResult {
  const { candles, signals, config } = input;
  const configErrors = validateBacktestConfig(config);
  if (configErrors.length > 0) {
    throw new Error(`回測參數不合法：${configErrors.join("；")}`);
  }

  const filtered = candles.filter((c) => c.openTime >= config.startTime && c.openTime <= config.endTime);
  const warnings: BacktestResult["warnings"] = [];

  if (filtered.length < 30) {
    warnings.push({
      code: "insufficient_data",
      message: `樣本 K 棒數僅 ${filtered.length} 根，資料量過少，回測結果可信度低，僅供參考`,
    });
  }

  const feeRate = config.feeRatePct / 100;
  const slippage = config.slippageRatePct / 100;

  const signalByTime = new Map<number, StrategySignal>();
  for (const s of signals) signalByTime.set(s.time, s);

  let cash = config.initialCapitalUsdt;
  let position: OpenPosition | null = null;
  const trades: TradeRecord[] = [];
  const equityCurve: EquityPoint[] = [];

  let buyHoldQuantity = 0;
  let buyHoldEntryDone = false;
  const buyHoldInitialCapital = config.initialCapitalUsdt;

  for (let i = 1; i < filtered.length; i++) {
    const candle = filtered[i]!;
    const prevCandle = filtered[i - 1]!;
    const prevSignal = signalByTime.get(prevCandle.openTime);
    const wasInPosition = position !== null;

    // 買進持有基準：於第一根可交易 K 棒開盤全額買入，之後不再交易
    if (!buyHoldEntryDone) {
      const fillPrice = candle.open * (1 + slippage);
      const fee = buyHoldInitialCapital * feeRate;
      buyHoldQuantity = (buyHoldInitialCapital - fee) / fillPrice;
      buyHoldEntryDone = true;
    }

    // 1. 若持有部位，先檢查停損／停利／移動停損／分批停利（以當根高低價判斷）
    if (position) {
      if (config.trailingStopPct !== null) {
        position.highestSinceEntry = Math.max(position.highestSinceEntry, candle.high);
      }
      const stopLossPrice =
        config.stopLossPct !== null ? position.entryPriceFilled * (1 - config.stopLossPct / 100) : null;
      const trailingStopPrice =
        config.trailingStopPct !== null
          ? position.highestSinceEntry * (1 - config.trailingStopPct / 100)
          : null;
      const split = config.splitTakeProfit;
      const tp1Price = split !== null ? position.entryPriceFilled * (1 + split.tp1Pct / 100) : null;
      const tp2Price = split !== null ? position.entryPriceFilled * (1 + split.tp2Pct / 100) : null;
      const singleTakeProfitPrice =
        split === null && config.takeProfitPct !== null
          ? position.entryPriceFilled * (1 + config.takeProfitPct / 100)
          : null;

      // 1a. 停損／移動停損優先於停利：同一根 K 棒內無法判斷觸價先後順序，保守假設停損優先觸發
      let stopExitPrice: number | null = null;
      let stopExitReason = "";
      if (stopLossPrice !== null && candle.low <= stopLossPrice) {
        stopExitPrice = stopLossPrice;
        stopExitReason = `觸發停損（${config.stopLossPct}%）`;
      } else if (trailingStopPrice !== null && candle.low <= trailingStopPrice) {
        stopExitPrice = trailingStopPrice;
        stopExitReason = `觸發移動停損（${config.trailingStopPct}%）`;
      }
      if (stopExitPrice !== null) {
        const trade = exitPosition(
          position,
          candle.openTime,
          stopExitPrice,
          stopExitReason,
          feeRate,
          slippage,
          position.quantity,
          undefined,
        );
        trades.push(trade);
        cash += trade.quantity * trade.exitPrice - trade.exitFee;
        position = null;
      }

      // 1b. 分批停利 TP1：出清一部分部位，剩餘部位繼續持有
      if (position && split !== null && !position.tp1Filled && tp1Price !== null && candle.high >= tp1Price) {
        const qty1 = Math.min(position.originalQuantity * (split.tp1SizePct / 100), position.quantity);
        const trade = exitPosition(
          position,
          candle.openTime,
          tp1Price,
          `觸發 TP1 分批停利（+${split.tp1Pct}%，出場 ${split.tp1SizePct}% 部位）`,
          feeRate,
          slippage,
          qty1,
          "tp1",
        );
        trades.push(trade);
        cash += trade.quantity * trade.exitPrice - trade.exitFee;
        position.tp1Filled = true;
        if (position.quantity <= 1e-12) position = null;
      }

      // 1c. 分批停利 TP2（需 TP1 已觸發）或單一停利：出清剩餘部位
      if (position) {
        if (split !== null) {
          if (position.tp1Filled && tp2Price !== null && candle.high >= tp2Price) {
            const trade = exitPosition(
              position,
              candle.openTime,
              tp2Price,
              `觸發 TP2 分批停利（+${split.tp2Pct}%）`,
              feeRate,
              slippage,
              position.quantity,
              "tp2",
            );
            trades.push(trade);
            cash += trade.quantity * trade.exitPrice - trade.exitFee;
            position = null;
          }
        } else if (singleTakeProfitPrice !== null && candle.high >= singleTakeProfitPrice) {
          const trade = exitPosition(
            position,
            candle.openTime,
            singleTakeProfitPrice,
            `觸發停利（${config.takeProfitPct}%）`,
            feeRate,
            slippage,
            position.quantity,
            undefined,
          );
          trades.push(trade);
          cash += trade.quantity * trade.exitPrice - trade.exitFee;
          position = null;
        }
      }
    }

    // 2. 若仍持有部位，檢查前一根訊號是否為出場訊號
    if (position && prevSignal && (prevSignal.type === "bearish_candidate" || prevSignal.type === "risk_up")) {
      const trade = exitPosition(
        position,
        candle.openTime,
        candle.open,
        prevSignal.type === "risk_up" ? "策略風險升高訊號出場" : "策略偏空候選訊號出場",
        feeRate,
        slippage,
        position.quantity,
        undefined,
      );
      trades.push(trade);
      cash += trade.quantity * trade.exitPrice - trade.exitFee;
      position = null;
    }

    // 3. 若進入此根 K 棒前為空手，且前一根訊號為偏多候選，則於本根開盤進場
    if (!wasInPosition && !position && prevSignal && prevSignal.type === "bullish_candidate") {
      const investAmount = computeInvestAmount(cash, config);
      if (investAmount > 0) {
        const fillPrice = candle.open * (1 + slippage);
        const fee = investAmount * feeRate;
        const quantity = (investAmount - fee) / fillPrice;
        cash -= investAmount;
        position = {
          entryTime: candle.openTime,
          entryPriceRaw: candle.open,
          entryPriceFilled: fillPrice,
          quantity,
          originalQuantity: quantity,
          costBasis: investAmount,
          originalCostBasis: investAmount,
          originalEntryFee: fee,
          entryReason: prevSignal.reason,
          paramsSnapshot: prevSignal.params,
          highestSinceEntry: candle.high,
          tp1Filled: false,
        };
      }
    }

    const positionValue = position ? position.quantity * candle.close : 0;
    const buyHoldEquity = buyHoldQuantity * candle.close;
    equityCurve.push({
      time: candle.openTime,
      equity: cash + positionValue,
      buyHoldEquity,
      inPosition: position !== null,
    });
  }

  // 回測結束仍持有部位：以最後收盤價強制平倉結算，並標註原因
  if (position && filtered.length > 0) {
    const last = filtered[filtered.length - 1]!;
    const trade = exitPosition(
      position,
      last.openTime,
      last.close,
      "回測期間結束，以最後收盤價結算",
      feeRate,
      slippage,
      position.quantity,
      undefined,
    );
    trades.push(trade);
    cash += trade.quantity * trade.exitPrice - trade.exitFee;
    if (equityCurve.length > 0) {
      equityCurve[equityCurve.length - 1]!.equity = cash;
      equityCurve[equityCurve.length - 1]!.inPosition = false;
    }
  }

  return {
    trades,
    equityCurve,
    warnings,
    config,
    usedCandles: filtered.length,
    firstTradableTime: filtered[0]?.openTime ?? null,
    lastTime: filtered[filtered.length - 1]?.openTime ?? null,
  };
}

/**
 * 計算本次進場要投入的金額。
 * 預設（riskBasedSizing 為 null）：固定投入目前可用資金的 positionSizePct%。
 * 啟用固定風險比例部位（1R）時：反推「虧到停損價時，虧損金額剛好等於可用資金的 riskPct%」所需的部位金額；
 * 現貨不開槓桿，若反推出來的金額超過目前可用資金，會被限制在可用資金以內（此時實際風險低於 riskPct 的設定值）。
 */
function computeInvestAmount(cash: number, config: BacktestConfig): number {
  if (config.riskBasedSizing !== null && config.stopLossPct !== null) {
    const riskAmount = cash * (config.riskBasedSizing.riskPct / 100);
    const stopDistanceFraction = config.stopLossPct / 100;
    if (stopDistanceFraction <= 0) return 0;
    const rawInvestAmount = riskAmount / stopDistanceFraction;
    return Math.min(rawInvestAmount, cash);
  }
  return cash * (config.positionSizePct / 100);
}

/**
 * 將部位的一部分（或全部）出場，並就地更新部位剩餘的數量／成本基礎。
 * qty 可小於 position.quantity（分批停利 TP1），此時部位不會被呼叫端設為 null，仍需繼續追蹤剩餘部位。
 */
function exitPosition(
  position: OpenPosition,
  exitTime: number,
  exitPriceRaw: number,
  exitReason: string,
  feeRate: number,
  slippage: number,
  qty: number,
  tpStage: "tp1" | "tp2" | undefined,
): TradeRecord {
  const costBasisPortion = position.originalCostBasis * (qty / position.originalQuantity);
  const entryFeePortion = position.originalEntryFee * (qty / position.originalQuantity);
  const exitPriceFilled = exitPriceRaw * (1 - slippage);
  const proceeds = qty * exitPriceFilled;
  const exitFee = proceeds * feeRate;
  const netProceeds = proceeds - exitFee;
  const pnl = netProceeds - costBasisPortion;
  const pnlBeforeCost = qty * (exitPriceRaw - position.entryPriceRaw);
  const returnPct = costBasisPortion > 0 ? (pnl / costBasisPortion) * 100 : 0;

  position.quantity -= qty;
  position.costBasis -= costBasisPortion;

  return {
    entryTime: position.entryTime,
    entryPrice: position.entryPriceFilled,
    exitTime,
    exitPrice: exitPriceFilled,
    quantity: qty,
    entryFee: entryFeePortion,
    exitFee,
    totalCost: entryFeePortion + exitFee,
    pnl,
    pnlBeforeCost,
    returnPct,
    holdingMs: exitTime - position.entryTime,
    entryReason: position.entryReason,
    exitReason,
    paramsSnapshot: position.paramsSnapshot,
    ...(tpStage ? { tpStage } : {}),
  };
}

export type { BacktestConfig };
