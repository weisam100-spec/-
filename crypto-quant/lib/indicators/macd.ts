import { ema } from "./ema";

export interface MacdResult {
  macd: number[];
  signal: number[];
  histogram: number[];
}

/**
 * MACD：快線 EMA(fast) - 慢線 EMA(slow)，訊號線為 MACD 的 EMA(signalPeriod)。
 * 暖機期內回傳 NaN。
 */
export function macd(values: number[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9): MacdResult {
  if (fastPeriod >= slowPeriod) throw new Error("MACD 快線週期必須小於慢線週期");
  const fastEma = ema(values, fastPeriod);
  const slowEma = ema(values, slowPeriod);
  const macdLine = values.map((_, i) => {
    const f = fastEma[i]!;
    const s = slowEma[i]!;
    return Number.isNaN(f) || Number.isNaN(s) ? NaN : f - s;
  });

  // 對 MACD 線計算 EMA 時，需先移除前導 NaN，計算完再對齊回原本長度
  const firstValidIdx = macdLine.findIndex((v) => !Number.isNaN(v));
  const signalLine = new Array<number>(values.length).fill(NaN);
  if (firstValidIdx >= 0) {
    const validSegment = macdLine.slice(firstValidIdx);
    const signalOnSegment = ema(validSegment, signalPeriod);
    signalOnSegment.forEach((v, i) => {
      signalLine[firstValidIdx + i] = v;
    });
  }

  const histogram = macdLine.map((v, i) => {
    const s = signalLine[i]!;
    return Number.isNaN(v) || Number.isNaN(s) ? NaN : v - s;
  });

  return { macd: macdLine, signal: signalLine, histogram };
}
