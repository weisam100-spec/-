import type { Candle } from "@/lib/market/types";

export interface FibonacciLevel {
  ratio: number;
  price: number;
  label: string;
}

export interface FibonacciRetracement {
  /**
   * retracement_down：近期走勢為「低點在前、高點在後」（上升段），以高點為 0%、低點為 100%，
   * 測量價格從高點拉回時的潛在支撐位。
   * retracement_up：近期走勢為「高點在前、低點在後」（下降段），以低點為 0%、高點為 100%，
   * 測量價格從低點反彈時的潛在壓力位。
   */
  direction: "retracement_down" | "retracement_up";
  anchorHighTime: number;
  anchorHighPrice: number;
  anchorLowTime: number;
  anchorLowPrice: number;
  levels: FibonacciLevel[];
}

const DEFAULT_RATIOS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

/**
 * 自動抓取「近期視窗內」的最高點與最低點，以兩者之間的價格區間畫出標準費波那契回檔水平線
 * （0% / 23.6% / 38.2% / 50% / 61.8% / 78.6% / 100%）。
 * 純屬依既定公式對歷史高低點做幾何切割，不是預測，也不保證價格會在這些價位反應。
 */
export function computeFibonacciRetracement(
  candles: Candle[],
  opts: { lookback?: number; ratios?: number[] } = {},
): FibonacciRetracement | null {
  const lookback = opts.lookback ?? 120;
  const ratios = opts.ratios ?? DEFAULT_RATIOS;
  if (candles.length < 5) return null;

  const window = candles.slice(-lookback);
  let highIdx = 0;
  let lowIdx = 0;
  for (let i = 1; i < window.length; i++) {
    if (window[i]!.high > window[highIdx]!.high) highIdx = i;
    if (window[i]!.low < window[lowIdx]!.low) lowIdx = i;
  }

  const highCandle = window[highIdx]!;
  const lowCandle = window[lowIdx]!;
  const range = highCandle.high - lowCandle.low;
  if (range <= 0) return null;

  const direction: FibonacciRetracement["direction"] =
    highIdx >= lowIdx ? "retracement_down" : "retracement_up";

  const levels: FibonacciLevel[] = ratios.map((ratio) => {
    const price =
      direction === "retracement_down"
        ? highCandle.high - range * ratio
        : lowCandle.low + range * ratio;
    return { ratio, price, label: `${(ratio * 100).toFixed(1)}%` };
  });

  return {
    direction,
    anchorHighTime: highCandle.openTime,
    anchorHighPrice: highCandle.high,
    anchorLowTime: lowCandle.openTime,
    anchorLowPrice: lowCandle.low,
    levels,
  };
}
