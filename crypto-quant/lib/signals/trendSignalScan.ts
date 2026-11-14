import type { Candle } from "@/lib/market/types";
import type { Interval } from "@/lib/market/symbols";
import { fvgSupplyDemandStrategy, fvgSupplyDemandDefaultParams } from "@/lib/strategies/fvgSupplyDemand";
import { SIGNAL_TYPE_LABEL, type SignalType } from "@/lib/strategies/types";

export interface TrendSignalCard {
  symbol: string;
  interval: Interval;
  /** 該交易對在這個週期下，套用「FVG 價格失衡區＋供需區策略」預設參數的最新候選訊號；無則為 null */
  signal: { time: number; type: SignalType; label: string; price: number; confidence: number } | null;
  /** 資料中最後一根 K 棒的收盤價，作為目前參考價格（可能是尚未收盤的即時價格） */
  currentPrice: number;
  /** 目前價格相對於訊號觸發價格的變動百分比；無訊號時為 null */
  changeSinceSignalPct: number | null;
  windowHigh: number;
  windowLow: number;
  sparkline: { time: number; close: number }[];
}

/**
 * 純函式：在給定的 K 棒序列上套用既有的「FVG 價格失衡區＋供需區策略」（預設參數），
 * 整理成「趨勢訊號」卡片要顯示的資料。純粹是把本站既有策略的歷史訊號偵測結果重新呈現，
 * 不是新的預測邏輯，也不是依多個交易對排名的推薦名單——每張卡片只反映各自交易對
 * 獨立套用同一套公開定義規則後的結果。
 */
export function buildTrendSignalCard(
  candles: Candle[],
  symbol: string,
  interval: Interval,
  windowBars: number,
): TrendSignalCard | null {
  if (candles.length === 0) return null;

  const signals = fvgSupplyDemandStrategy.generateSignals(candles, fvgSupplyDemandDefaultParams, { symbol, interval });
  const latest = signals[signals.length - 1] ?? null;

  const last = candles[candles.length - 1]!;
  const currentPrice = last.close;

  const windowSlice = candles.slice(-Math.max(1, windowBars));
  const windowHigh = Math.max(...windowSlice.map((c) => c.high));
  const windowLow = Math.min(...windowSlice.map((c) => c.low));

  return {
    symbol,
    interval,
    signal: latest
      ? {
          time: latest.time,
          type: latest.type,
          label: SIGNAL_TYPE_LABEL[latest.type],
          price: latest.price,
          confidence: latest.confidence,
        }
      : null,
    currentPrice,
    changeSinceSignalPct: latest ? ((currentPrice - latest.price) / latest.price) * 100 : null,
    windowHigh,
    windowLow,
    sparkline: windowSlice.map((c) => ({ time: c.openTime, close: c.close })),
  };
}
