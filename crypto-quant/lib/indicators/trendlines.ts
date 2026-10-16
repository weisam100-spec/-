import type { Candle } from "@/lib/market/types";
import {
  computeSwingEvents,
  type SwingEvent,
} from "@/lib/strategies/marketStructure";

export interface Trendline {
  type: "uptrend" | "downtrend";
  startTime: number;
  startPrice: number;
  endTime: number;
  endPrice: number;
  /** 有多少個擺動點落在這條線附近（含兩端點），次數越多代表這條趨勢線越站得住腳 */
  touchCount: number;
  strength: "weak" | "medium" | "strong";
}

function strengthOf(touchCount: number): Trendline["strength"] {
  if (touchCount >= 4) return "strong";
  if (touchCount === 3) return "medium";
  return "weak";
}

function lineValueAt(
  p1: { time: number; price: number },
  p2: { time: number; price: number },
  t: number,
): number {
  const slope = (p2.price - p1.price) / (p2.time - p1.time);
  return p1.price + slope * (t - p1.time);
}

/**
 * 在擺動點中找出一條「未被跌破（上升線）／未被站上（下降線）」的最佳趨勢線：
 * 兩點決定一條線，從起點延伸到最新一根 K 棒；只採用期間內沒有任何 K 棒明顯穿越這條線的組合，
 * 多組合法候選時，優先選擇「觸碰次數」最多的（代表越多擺動點真的貼著這條線），
 * 次要比較才看終點時間是否較新。
 */
function fitBestLine(
  pivots: SwingEvent[],
  direction: "up" | "down",
  candles: Candle[],
  tolerancePct: number,
  maxLookbackPivots: number,
): Trendline | null {
  const recent = pivots.slice(-maxLookbackPivots);
  if (recent.length < 2) return null;

  const lastCandleTime = candles[candles.length - 1]!.openTime;
  let best: { i: number; j: number; touchCount: number } | null = null;

  for (let i = 0; i < recent.length; i++) {
    for (let j = i + 1; j < recent.length; j++) {
      const p1 = recent[i]!;
      const p2 = recent[j]!;
      if (direction === "up" && !(p2.price > p1.price)) continue;
      if (direction === "down" && !(p2.price < p1.price)) continue;

      let violated = false;
      for (const c of candles) {
        if (c.openTime < p1.time || c.openTime > lastCandleTime) continue;
        const lineValue = lineValueAt(p1, p2, c.openTime);
        const tolerance = (Math.abs(lineValue) * tolerancePct) / 100;
        if (direction === "up" && c.low < lineValue - tolerance) {
          violated = true;
          break;
        }
        if (direction === "down" && c.high > lineValue + tolerance) {
          violated = true;
          break;
        }
      }
      if (violated) continue;

      let touchCount = 0;
      for (const pv of recent) {
        const lineValue = lineValueAt(p1, p2, pv.time);
        const tolerance = (Math.abs(lineValue) * tolerancePct) / 100;
        if (Math.abs(pv.price - lineValue) <= tolerance) touchCount++;
      }

      if (
        !best ||
        touchCount > best.touchCount ||
        (touchCount === best.touchCount && j > best.j)
      ) {
        best = { i, j, touchCount };
      }
    }
  }

  if (!best) return null;
  const p1 = recent[best.i]!;
  const p2 = recent[best.j]!;
  const endPrice = lineValueAt(p1, p2, lastCandleTime);
  return {
    type: direction === "up" ? "uptrend" : "downtrend",
    startTime: p1.time,
    startPrice: p1.price,
    endTime: lastCandleTime,
    endPrice,
    touchCount: best.touchCount,
    strength: strengthOf(best.touchCount),
  };
}

/**
 * 以市場結構擺動高/低點為基礎自動偵測上升趨勢線（連接擺動低點）與下降趨勢線（連接擺動高點），
 * 只採用「目前尚未被價格跌破／站上」的組合，純屬歷史價格結構的幾何描繪，不是預測。
 */
export function computeTrendlines(
  candles: Candle[],
  opts: {
    swingLookback?: number;
    tolerancePct?: number;
    maxLookbackPivots?: number;
  } = {},
): { uptrend: Trendline | null; downtrend: Trendline | null } {
  const swingLookback = opts.swingLookback ?? 3;
  const tolerancePct = opts.tolerancePct ?? 0.3;
  const maxLookbackPivots = opts.maxLookbackPivots ?? 8;

  if (candles.length < swingLookback * 2 + 4)
    return { uptrend: null, downtrend: null };

  const events = computeSwingEvents(candles, swingLookback);
  const lows = events
    .filter((e) => e.type === "low")
    .sort((a, b) => a.time - b.time);
  const highs = events
    .filter((e) => e.type === "high")
    .sort((a, b) => a.time - b.time);

  return {
    uptrend: fitBestLine(lows, "up", candles, tolerancePct, maxLookbackPivots),
    downtrend: fitBestLine(
      highs,
      "down",
      candles,
      tolerancePct,
      maxLookbackPivots,
    ),
  };
}
