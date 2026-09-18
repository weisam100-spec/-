/**
 * 指數移動平均線（EMA）。
 * 前 period-1 個位置為暖機期，回傳 NaN，避免被誤用於產生訊號。
 */
export function ema(values: number[], period: number): number[] {
  if (period <= 0) throw new Error("EMA period 必須為正整數");
  const out = new Array<number>(values.length).fill(NaN);
  if (values.length === 0) return out;

  const k = 2 / (period + 1);
  // 以前 period 筆的簡單平均作為種子值，常見且穩定的做法
  if (values.length < period) return out;

  let seed = 0;
  for (let i = 0; i < period; i++) seed += values[i]!;
  seed /= period;
  out[period - 1] = seed;

  let prev = seed;
  for (let i = period; i < values.length; i++) {
    const next = values[i]! * k + prev * (1 - k);
    out[i] = next;
    prev = next;
  }
  return out;
}

export function sma(values: number[], period: number): number[] {
  if (period <= 0) throw new Error("SMA period 必須為正整數");
  const out = new Array<number>(values.length).fill(NaN);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i]!;
    if (i >= period) sum -= values[i - period]!;
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function stddev(values: number[], period: number): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  const means = sma(values, period);
  for (let i = period - 1; i < values.length; i++) {
    let sumSq = 0;
    const mean = means[i]!;
    for (let j = i - period + 1; j <= i; j++) {
      const d = values[j]! - mean;
      sumSq += d * d;
    }
    out[i] = Math.sqrt(sumSq / period);
  }
  return out;
}
