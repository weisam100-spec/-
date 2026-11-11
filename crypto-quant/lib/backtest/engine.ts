import type { StrategySignal } from "@/lib/strategies/types";
import type { BacktestConfig, BacktestResult, EquityPoint, RunBacktestInput, TradeRecord } from "./types";
import { validateBacktestConfig } from "./validate";

type PositionSide = "long" | "short";

interface OpenPosition {
  side: PositionSide;
  entryTime: number;
  entryPriceRaw: number;
  entryPriceFilled: number;
  /** 剩餘未出場的數量，分批停利 TP1 觸發後會減少 */
  quantity: number;
  /** 原始進場數量，作為分批停利出場比例的計算基準，不會變動 */
  originalQuantity: number;
  /** 剩餘成本基礎（多單：已投入成本；空單：鎖定的保證金／擔保品） */
  costBasis: number;
  /** 原始成本基礎，固定不變 */
  originalCostBasis: number;
  /** 原始進場手續費，固定不變，分批出場時依數量比例分攤 */
  originalEntryFee: number;
  entryReason: string;
  paramsSnapshot: Record<string, unknown>;
  /** 多單用：進場後至今最高價，供移動停損判斷 */
  highestSinceEntry: number;
  /** 空單用：進場後至今最低價，供移動停損判斷 */
  lowestSinceEntry: number;
  /** 分批停利 TP1 是否已觸發 */
  tp1Filled: boolean;
}

/** 依方向計算停損價；long 在進場價下方，short 在進場價上方 */
function stopLossPriceFor(side: PositionSide, entryPriceFilled: number, stopLossPct: number | null): number | null {
  if (stopLossPct === null) return null;
  return side === "long" ? entryPriceFilled * (1 - stopLossPct / 100) : entryPriceFilled * (1 + stopLossPct / 100);
}

/** 依方向計算移動停損價：long 用進場後最高價回落，short 用進場後最低價回升 */
function trailingStopPriceFor(side: PositionSide, extremeSinceEntry: number, trailingStopPct: number | null): number | null {
  if (trailingStopPct === null) return null;
  return side === "long"
    ? extremeSinceEntry * (1 - trailingStopPct / 100)
    : extremeSinceEntry * (1 + trailingStopPct / 100);
}

/** 依方向計算停利價；long 在進場價上方，short 在進場價下方 */
function takeProfitPriceFor(side: PositionSide, entryPriceFilled: number, pct: number | null): number | null {
  if (pct === null) return null;
  return side === "long" ? entryPriceFilled * (1 + pct / 100) : entryPriceFilled * (1 - pct / 100);
}

/** 停損／移動停損觸發判斷：long 看當根最低價跌破，short 看當根最高價站上 */
function isStopHit(side: PositionSide, candleLow: number, candleHigh: number, stopPrice: number): boolean {
  return side === "long" ? candleLow <= stopPrice : candleHigh >= stopPrice;
}

/** 停利觸發判斷：long 看當根最高價站上，short 看當根最低價跌破 */
function isTakeProfitHit(side: PositionSide, candleLow: number, candleHigh: number, tpPrice: number): boolean {
  return side === "long" ? candleHigh >= tpPrice : candleLow <= tpPrice;
}

/**
 * 回測核心引擎。
 * 防未來函數原則：第 i 根 K 棒收盤才產生訊號，訊號最早在第 i+1 根 K 棒的開盤成交；
 * 停損／停利／移動停損於進場後每一根 K 棒依當根高低價檢查是否觸發。
 * 第一版（direction: "long_only"）僅支援現貨多頭單一持倉模擬。
 * "long_short" 模式會額外模擬放空部位的損益，這是「假設用保證金／合約放空、方向判斷正確或錯誤
 * 各會賺賠多少」的簡化分析，並未模擬真實保證金交易的借貸成本、資金費率與強制平倉機制，
 * 本站任何模式下都不會真的執行下單。
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
  const allowShort = config.direction === "long_short";

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
      const side = position.side;
      if (config.trailingStopPct !== null) {
        if (side === "long") position.highestSinceEntry = Math.max(position.highestSinceEntry, candle.high);
        else position.lowestSinceEntry = Math.min(position.lowestSinceEntry, candle.low);
      }
      const stopLossPrice = stopLossPriceFor(side, position.entryPriceFilled, config.stopLossPct);
      const trailingStopPrice = trailingStopPriceFor(
        side,
        side === "long" ? position.highestSinceEntry : position.lowestSinceEntry,
        config.trailingStopPct,
      );
      const split = config.splitTakeProfit;
      const tp1Price = split !== null ? takeProfitPriceFor(side, position.entryPriceFilled, split.tp1Pct) : null;
      const tp2Price = split !== null ? takeProfitPriceFor(side, position.entryPriceFilled, split.tp2Pct) : null;
      const singleTakeProfitPrice =
        split === null ? takeProfitPriceFor(side, position.entryPriceFilled, config.takeProfitPct) : null;

      // 1a. 停損／移動停損優先於停利：同一根 K 棒內無法判斷觸價先後順序，保守假設停損優先觸發
      let stopExitPrice: number | null = null;
      let stopExitReason = "";
      if (stopLossPrice !== null && isStopHit(side, candle.low, candle.high, stopLossPrice)) {
        stopExitPrice = stopLossPrice;
        stopExitReason = `觸發停損（${config.stopLossPct}%）`;
      } else if (trailingStopPrice !== null && isStopHit(side, candle.low, candle.high, trailingStopPrice)) {
        stopExitPrice = trailingStopPrice;
        stopExitReason = `觸發移動停損（${config.trailingStopPct}%）`;
      }
      if (stopExitPrice !== null) {
        const { trade, cashDelta } = exitPosition(
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
        cash += cashDelta;
        position = null;
      }

      // 1b. 分批停利 TP1：出清一部分部位，剩餘部位繼續持有
      if (position && split !== null && !position.tp1Filled && tp1Price !== null && isTakeProfitHit(side, candle.low, candle.high, tp1Price)) {
        const qty1 = Math.min(position.originalQuantity * (split.tp1SizePct / 100), position.quantity);
        const { trade, cashDelta } = exitPosition(
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
        cash += cashDelta;
        position.tp1Filled = true;
        if (position.quantity <= 1e-12) position = null;
      }

      // 1c. 分批停利 TP2（需 TP1 已觸發）或單一停利：出清剩餘部位
      if (position) {
        if (split !== null) {
          if (position.tp1Filled && tp2Price !== null && isTakeProfitHit(side, candle.low, candle.high, tp2Price)) {
            const { trade, cashDelta } = exitPosition(
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
            cash += cashDelta;
            position = null;
          }
        } else if (singleTakeProfitPrice !== null && isTakeProfitHit(side, candle.low, candle.high, singleTakeProfitPrice)) {
          const { trade, cashDelta } = exitPosition(
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
          cash += cashDelta;
          position = null;
        }
      }
    }

    // 2. 若仍持有部位，檢查前一根訊號是否為反方向出場訊號
    if (position && prevSignal) {
      const isOppositeSignal =
        position.side === "long"
          ? prevSignal.type === "bearish_candidate" || prevSignal.type === "risk_up"
          : prevSignal.type === "bullish_candidate" || prevSignal.type === "risk_up";
      if (isOppositeSignal) {
        const { trade, cashDelta } = exitPosition(
          position,
          candle.openTime,
          candle.open,
          prevSignal.type === "risk_up" ? "策略風險升高訊號出場" : "策略反方向候選訊號出場",
          feeRate,
          slippage,
          position.quantity,
          undefined,
        );
        trades.push(trade);
        cash += cashDelta;
        position = null;
      }
    }

    // 3. 若進入此根 K 棒前為空手，且前一根訊號支援進場方向，則於本根開盤進場
    if (!wasInPosition && !position && prevSignal) {
      const side: PositionSide | null =
        prevSignal.type === "bullish_candidate" ? "long" : prevSignal.type === "bearish_candidate" && allowShort ? "short" : null;
      if (side !== null) {
        const investAmount = computeInvestAmount(cash, config);
        if (investAmount > 0) {
          const fillPrice = side === "long" ? candle.open * (1 + slippage) : candle.open * (1 - slippage);
          const fee = investAmount * feeRate;
          const quantity = (investAmount - fee) / fillPrice;
          cash -= investAmount;
          position = {
            side,
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
            lowestSinceEntry: candle.low,
            tp1Filled: false,
          };
        }
      }
    }

    const positionValue = position
      ? position.side === "long"
        ? position.quantity * candle.close
        : position.costBasis + position.quantity * (position.entryPriceFilled - candle.close)
      : 0;
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
    const { trade, cashDelta } = exitPosition(
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
    cash += cashDelta;
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
 * 計算本次進場要投入的金額（多單＝投入成本，空單＝鎖定的保證金／擔保品，會計方式相同）。
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
 * 回傳的 cashDelta 是這筆出場應該加回 cash 的金額（多空通用的會計方式：鎖定的成本基礎全數歸還＋已實現損益）。
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
): { trade: TradeRecord; cashDelta: number } {
  const costBasisPortion = position.originalCostBasis * (qty / position.originalQuantity);
  const entryFeePortion = position.originalEntryFee * (qty / position.originalQuantity);
  const exitPriceFilled = position.side === "long" ? exitPriceRaw * (1 - slippage) : exitPriceRaw * (1 + slippage);
  const proceeds = qty * exitPriceFilled;
  const exitFee = proceeds * feeRate;

  const pnl =
    position.side === "long"
      ? qty * (exitPriceFilled - position.entryPriceFilled) - entryFeePortion - exitFee
      : qty * (position.entryPriceFilled - exitPriceFilled) - entryFeePortion - exitFee;
  const pnlBeforeCost =
    position.side === "long"
      ? qty * (exitPriceRaw - position.entryPriceRaw)
      : qty * (position.entryPriceRaw - exitPriceRaw);
  const returnPct = costBasisPortion > 0 ? (pnl / costBasisPortion) * 100 : 0;

  position.quantity -= qty;
  position.costBasis -= costBasisPortion;

  const trade: TradeRecord = {
    side: position.side,
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

  return { trade, cashDelta: costBasisPortion + pnl };
}

export type { BacktestConfig };
