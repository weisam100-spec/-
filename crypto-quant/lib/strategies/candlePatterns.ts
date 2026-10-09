import type { Candle } from "@/lib/market/types";

/**
 * 常見反轉 K 棒型態判斷，供「區間支撐＋反轉K線」等策略使用。
 * 皆為單純依當根（或當根＋前一根）K 棒幾何形狀判斷的明確規則，非黑箱。
 */

function bodySize(c: Candle): number {
  return Math.abs(c.close - c.open);
}
function range(c: Candle): number {
  return c.high - c.low;
}
function upperWick(c: Candle): number {
  return c.high - Math.max(c.open, c.close);
}
function lowerWick(c: Candle): number {
  return Math.min(c.open, c.close) - c.low;
}

/** 槌子線（Hammer）：下影線長、實體小且偏上緣，常見於底部反轉 */
export function isHammer(c: Candle, minWickToBodyRatio = 2): boolean {
  const body = bodySize(c);
  const r = range(c);
  if (r <= 0) return false;
  const lw = lowerWick(c);
  const uw = upperWick(c);
  if (body === 0) return lw > r * 0.6 && uw < r * 0.15;
  return lw >= body * minWickToBodyRatio && uw <= body * 0.5;
}

/** 流星線（Shooting Star）：上影線長、實體小且偏下緣，常見於頂部反轉 */
export function isShootingStar(c: Candle, minWickToBodyRatio = 2): boolean {
  const body = bodySize(c);
  const r = range(c);
  if (r <= 0) return false;
  const uw = upperWick(c);
  const lw = lowerWick(c);
  if (body === 0) return uw > r * 0.6 && lw < r * 0.15;
  return uw >= body * minWickToBodyRatio && lw <= body * 0.5;
}

/** 多頭吞噬（Bullish Engulfing）：當根陽線實體完全吞噬前一根陰線實體 */
export function isBullishEngulfing(prev: Candle, cur: Candle): boolean {
  const prevBearish = prev.close < prev.open;
  const curBullish = cur.close > cur.open;
  if (!prevBearish || !curBullish) return false;
  return cur.open <= prev.close && cur.close >= prev.open;
}

/** 空頭吞噬（Bearish Engulfing）：當根陰線實體完全吞噬前一根陽線實體 */
export function isBearishEngulfing(prev: Candle, cur: Candle): boolean {
  const prevBullish = prev.close > prev.open;
  const curBearish = cur.close < cur.open;
  if (!prevBullish || !curBearish) return false;
  return cur.open >= prev.close && cur.close <= prev.open;
}

export function isBullishReversalCandle(prev: Candle, cur: Candle): { matched: boolean; pattern: string } {
  if (isHammer(cur)) return { matched: true, pattern: "槌子線" };
  if (isBullishEngulfing(prev, cur)) return { matched: true, pattern: "多頭吞噬" };
  return { matched: false, pattern: "" };
}

export function isBearishReversalCandle(prev: Candle, cur: Candle): { matched: boolean; pattern: string } {
  if (isShootingStar(cur)) return { matched: true, pattern: "流星線" };
  if (isBearishEngulfing(prev, cur)) return { matched: true, pattern: "空頭吞噬" };
  return { matched: false, pattern: "" };
}
