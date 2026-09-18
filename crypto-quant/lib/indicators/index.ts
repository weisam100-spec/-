export * from "./ema";
export * from "./rsi";
export * from "./macd";
export * from "./bollinger";
export * from "./volatility";

/** 成交量相對於過去均量的比值，>1 代表量能放大 */
export function volumeRatio(volumes: number[], period = 20): number[] {
  const out = new Array<number>(volumes.length).fill(NaN);
  let sum = 0;
  for (let i = 0; i < volumes.length; i++) {
    sum += volumes[i]!;
    if (i >= period) sum -= volumes[i - period]!;
    if (i >= period - 1) {
      const avg = sum / period;
      out[i] = avg > 0 ? volumes[i]! / avg : NaN;
    }
  }
  return out;
}
