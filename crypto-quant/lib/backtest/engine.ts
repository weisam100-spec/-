import type { StrategySignal } from "@/lib/strategies/types";
import type { BacktestConfig, BacktestResult, EquityPoint, RunBacktestInput, TradeRecord } from "./types";
import { validateBacktestConfig } from "./validate";

interface OpenPosition {
  entryTime: number;
  entryPriceRaw: number;
  entryPriceFilled: number;
  quantity: number;
  entryFee: number;
  costBasis: number; // quantity * entryPriceFilled + entryFee
  entryReason: string;
  paramsSnapshot: Record<string, unknown>;
  highestSinceEntry: number;
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

    // 1. 若持有部位，先檢查停損／停利／移動停損（以當根高低價判斷）
    if (position) {
      if (config.trailingStopPct !== null) {
        position.highestSinceEntry = Math.max(position.highestSinceEntry, candle.high);
      }
      const stopLossPrice =
        config.stopLossPct !== null ? position.entryPriceFilled * (1 - config.stopLossPct / 100) : null;
      const takeProfitPrice =
        config.takeProfitPct !== null ? position.entryPriceFilled * (1 + config.takeProfitPct / 100) : null;
      const trailingStopPrice =
        config.trailingStopPct !== null
          ? position.highestSinceEntry * (1 - config.trailingStopPct / 100)
          : null;

      let exitPrice: number | null = null;
      let exitReason = "";
      if (stopLossPrice !== null && candle.low <= stopLossPrice) {
        exitPrice = stopLossPrice;
        exitReason = `觸發停損（${config.stopLossPct}%）`;
      } else if (trailingStopPrice !== null && candle.low <= trailingStopPrice) {
        exitPrice = trailingStopPrice;
        exitReason = `觸發移動停損（${config.trailingStopPct}%）`;
      } else if (takeProfitPrice !== null && candle.high >= takeProfitPrice) {
        exitPrice = takeProfitPrice;
        exitReason = `觸發停利（${config.takeProfitPct}%）`;
      }

      if (exitPrice !== null) {
        const trade = closeTrade(position, candle.openTime, exitPrice, exitReason, feeRate, slippage);
        trades.push(trade);
        cash += trade.quantity * trade.exitPrice - trade.exitFee;
        position = null;
      }
    }

    // 2. 若仍持有部位，檢查前一根訊號是否為出場訊號
    if (position && prevSignal && (prevSignal.type === "bearish_candidate" || prevSignal.type === "risk_up")) {
      const trade = closeTrade(
        position,
        candle.openTime,
        candle.open,
        prevSignal.type === "risk_up" ? "策略風險升高訊號出場" : "策略偏空候選訊號出場",
        feeRate,
        slippage,
      );
      trades.push(trade);
      cash += trade.quantity * trade.exitPrice - trade.exitFee;
      position = null;
    }

    // 3. 若進入此根 K 棒前為空手，且前一根訊號為偏多候選，則於本根開盤進場
    if (!wasInPosition && !position && prevSignal && prevSignal.type === "bullish_candidate") {
      const investAmount = cash * (config.positionSizePct / 100);
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
          entryFee: fee,
          costBasis: investAmount,
          entryReason: prevSignal.reason,
          paramsSnapshot: prevSignal.params,
          highestSinceEntry: candle.high,
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
    const trade = closeTrade(position, last.openTime, last.close, "回測期間結束，以最後收盤價結算", feeRate, slippage);
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

function closeTrade(
  position: OpenPosition,
  exitTime: number,
  exitPriceRaw: number,
  exitReason: string,
  feeRate: number,
  slippage: number,
): TradeRecord {
  const exitPriceFilled = exitPriceRaw * (1 - slippage);
  const proceeds = position.quantity * exitPriceFilled;
  const exitFee = proceeds * feeRate;
  const netProceeds = proceeds - exitFee;
  const pnl = netProceeds - position.costBasis;
  const pnlBeforeCost = position.quantity * (exitPriceRaw - position.entryPriceRaw);
  const returnPct = position.costBasis > 0 ? (pnl / position.costBasis) * 100 : 0;

  return {
    entryTime: position.entryTime,
    entryPrice: position.entryPriceFilled,
    exitTime,
    exitPrice: exitPriceFilled,
    quantity: position.quantity,
    entryFee: position.entryFee,
    exitFee,
    totalCost: position.entryFee + exitFee,
    pnl,
    pnlBeforeCost,
    returnPct,
    holdingMs: exitTime - position.entryTime,
    entryReason: position.entryReason,
    exitReason,
    paramsSnapshot: position.paramsSnapshot,
  };
}

export type { BacktestConfig };
