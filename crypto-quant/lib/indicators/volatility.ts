/**
 * 以對數報酬率的滾動標準差估計波動度（未年化，逐棒單位）。
 */
export function rollingVolatility(closes: number[], period = 20): number[] {
  const out = new Array<number>(closes.length).fill(NaN);
  if (closes.length < 2) return out;
  const logReturns = new Array<number>(closes.length).fill(NaN);
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1]!;
    const cur = closes[i]!;
    logReturns[i] = prev > 0 && cur > 0 ? Math.log(cur / prev) : NaN;
  }
  for (let i = period; i < closes.length; i++) {
    const window = logReturns.slice(i - period + 1, i + 1);
    if (window.some((v) => Number.isNaN(v))) continue;
    const mean = window.reduce((a, b) => a + b, 0) / window.length;
    const variance = window.reduce((a, b) => a + (b - mean) ** 2, 0) / window.length;
    out[i] = Math.sqrt(variance);
  }
  return out;
}

/** 年化係數：依 K 線週期估計一年內的棒數 */
export function annualizationFactor(barsPerYear: number): number {
  return Math.sqrt(barsPerYear);
}
