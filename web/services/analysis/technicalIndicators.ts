import type {
  KdResult,
  MacdResult,
  MovingAverages,
  OhlcvBar,
  TechnicalIndicators,
  TrendPattern,
  VolumeStats,
} from "@/lib/types/stock";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function average(nums: number[]): number {
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

/** Simple moving average of `close`, using the most recent `period` bars. */
export function calculateMA(bars: OhlcvBar[], period: number): number | null {
  if (bars.length < period) return null;
  const window = bars.slice(bars.length - period);
  return round2(average(window.map((b) => b.close)));
}

/** MA value at every bar (for charting), not just the latest bar. */
export function calculateMASeries(bars: OhlcvBar[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < bars.length; i++) {
    out.push(i + 1 >= period ? calculateMA(bars.slice(0, i + 1), period) : null);
  }
  return out;
}

export function calculateAllMA(bars: OhlcvBar[]): MovingAverages {
  return {
    ma5: calculateMA(bars, 5),
    ma10: calculateMA(bars, 10),
    ma20: calculateMA(bars, 20),
    ma60: calculateMA(bars, 60),
    ma120: calculateMA(bars, 120),
    ma240: calculateMA(bars, 240),
  };
}

/** RSI(period), simple-average variant (not Wilder-smoothed). */
export function calculateRSI(bars: OhlcvBar[], period = 14): number {
  if (bars.length < period + 1) return 50;
  const window = bars.slice(bars.length - period - 1);
  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i < window.length; i++) {
    const diff = window[i].close - window[i - 1].close;
    if (diff >= 0) gainSum += diff;
    else lossSum += -diff;
  }
  const avgGain = gainSum / period;
  const avgLoss = lossSum / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return round2(100 - 100 / (1 + rs));
}

function emaSeries(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    out.push(values[i] * k + out[i - 1] * (1 - k));
  }
  return out;
}

export function calculateMACD(bars: OhlcvBar[]): MacdResult {
  const closes = bars.map((b) => b.close);
  const emaFast = emaSeries(closes, 12);
  const emaSlow = emaSeries(closes, 26);
  const difSeries = emaFast.map((v, i) => v - emaSlow[i]);
  const macdSeries = emaSeries(difSeries, 9);
  const oscSeries = difSeries.map((v, i) => v - macdSeries[i]);

  const dif = difSeries[difSeries.length - 1];
  const macd = macdSeries[macdSeries.length - 1];
  const osc = oscSeries[oscSeries.length - 1];
  const prevOsc = oscSeries[oscSeries.length - 2] ?? osc;

  let signal: MacdResult["signal"] = "neutral";
  if (prevOsc <= 0 && osc > 0) signal = "golden_cross";
  else if (prevOsc >= 0 && osc < 0) signal = "death_cross";
  else if (osc > 0) signal = "bullish";
  else if (osc < 0) signal = "bearish";

  return { dif: round2(dif), macd: round2(macd), osc: round2(osc), signal };
}

export function calculateKD(bars: OhlcvBar[], period = 9): KdResult {
  let prevK = 50;
  let prevD = 50;
  let k = 50;
  let d = 50;

  for (let i = 0; i < bars.length; i++) {
    const window = bars.slice(Math.max(0, i - period + 1), i + 1);
    const high = Math.max(...window.map((b) => b.high));
    const low = Math.min(...window.map((b) => b.low));
    const rsv = high === low ? 50 : ((bars[i].close - low) / (high - low)) * 100;
    prevK = k;
    prevD = d;
    k = (prevK * 2) / 3 + rsv / 3;
    d = (prevD * 2) / 3 + k / 3;
  }

  let signal: KdResult["signal"] = "neutral";
  if (prevK <= prevD && k > d) signal = "golden_cross";
  else if (prevK >= prevD && k < d) signal = "death_cross";
  else if (k > 80) signal = "overbought";
  else if (k < 20) signal = "oversold";

  return { k: round2(k), d: round2(d), signal };
}

export function calculateVolumeStats(bars: OhlcvBar[]): VolumeStats {
  const today = bars[bars.length - 1];
  const prior = bars.slice(0, -1);
  const avg = (n: number) => (prior.length >= 1 ? average(prior.slice(-n).map((b) => b.volume)) : 0);
  const avg20 = avg(20);
  return {
    today: today.volume,
    avg5: round2(avg(5)),
    avg20: round2(avg20),
    avg60: round2(avg(60)),
    ratioVsAvg20: avg20 > 0 ? round2(today.volume / avg20) : 0,
  };
}

export function buildTechnicalIndicators(bars: OhlcvBar[]): TechnicalIndicators {
  return {
    ma: calculateAllMA(bars),
    rsi14: calculateRSI(bars, 14),
    macd: calculateMACD(bars),
    kd: calculateKD(bars, 9),
    volumeStats: calculateVolumeStats(bars),
  };
}

export interface TechnicalClassification {
  trendPattern: TrendPattern;
  aboveMa5: boolean;
  aboveMa20: boolean;
  aboveMa60: boolean;
  aboveMa120: boolean;
  aboveMa240: boolean;
  rsiZone: "overbought" | "neutral" | "oversold";
}

export function classifyTechnical(
  bars: OhlcvBar[],
  indicators: TechnicalIndicators
): TechnicalClassification {
  const price = bars[bars.length - 1].close;
  const { ma5, ma20, ma60, ma120, ma240 } = indicators.ma;

  let trendPattern: TrendPattern = "盤整";
  if (ma5 !== null && ma20 !== null && ma60 !== null) {
    if (ma5 > ma20 && ma20 > ma60) trendPattern = "多頭排列";
    else if (ma5 < ma20 && ma20 < ma60) trendPattern = "空頭排列";
  }

  let rsiZone: TechnicalClassification["rsiZone"] = "neutral";
  if (indicators.rsi14 > 70) rsiZone = "overbought";
  else if (indicators.rsi14 < 30) rsiZone = "oversold";

  return {
    trendPattern,
    aboveMa5: ma5 !== null && price > ma5,
    aboveMa20: ma20 !== null && price > ma20,
    aboveMa60: ma60 !== null && price > ma60,
    aboveMa120: ma120 !== null && price > ma120,
    aboveMa240: ma240 !== null && price > ma240,
    rsiZone,
  };
}
