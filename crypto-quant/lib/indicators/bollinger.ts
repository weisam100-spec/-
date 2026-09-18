import { sma, stddev } from "./ema";

export interface BollingerResult {
  middle: number[];
  upper: number[];
  lower: number[];
  /** (close - lower) / (upper - lower)，用來判斷相對通道位置，0~1 之間，可能超出範圍 */
  percentB: number[];
}

export function bollinger(values: number[], period = 20, stdDevMultiplier = 2): BollingerResult {
  const middle = sma(values, period);
  const sd = stddev(values, period);
  const upper = middle.map((m, i) => (Number.isNaN(m) ? NaN : m + stdDevMultiplier * sd[i]!));
  const lower = middle.map((m, i) => (Number.isNaN(m) ? NaN : m - stdDevMultiplier * sd[i]!));
  const percentB = values.map((v, i) => {
    const u = upper[i]!;
    const l = lower[i]!;
    if (Number.isNaN(u) || Number.isNaN(l) || u === l) return NaN;
    return (v - l) / (u - l);
  });
  return { middle, upper, lower, percentB };
}
