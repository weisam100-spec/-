import type { Candle } from "@/lib/market/types";
import { computeSwingEvents } from "@/lib/strategies/marketStructure";

export interface KeyLevel {
  price: number;
  /** 相對目前參考價格：低於參考價視為支撐，高於參考價視為壓力 */
  type: "support" | "resistance";
  /** 該價位區間被擺動高/低點觸及的次數，次數越多代表該價位歷史上越常被市場認可，強度越高 */
  touchCount: number;
  strength: "weak" | "medium" | "strong";
  lastTouchTime: number;
  /** 與參考價格的距離百分比；壓力為正值，支撐為負值 */
  distancePct: number;
}

function strengthOf(touchCount: number): KeyLevel["strength"] {
  if (touchCount >= 3) return "strong";
  if (touchCount === 2) return "medium";
  return "weak";
}

/**
 * 以市場結構擺動高/低點（與 SMC/SMT 策略共用同一套無未來函數偵測邏輯）為基礎，
 * 把價格相近的擺動點聚合成一個個「關鍵價位區間」，再依與目前價格的相對位置
 * 分類為支撐／壓力，依「觸及次數」衡量該價位的歷史重要性。
 *
 * 這是純粹基於歷史價格結構的統計結果，不是預測，也不保證價格到了這些價位就會反轉或突破。
 */
export function computeKeyLevels(
  candles: Candle[],
  opts: { swingLookback?: number; clusterTolerancePct?: number; maxLevelsPerSide?: number } = {},
): KeyLevel[] {
  const swingLookback = opts.swingLookback ?? 3;
  const clusterTolerancePct = opts.clusterTolerancePct ?? 0.6;
  const maxLevelsPerSide = opts.maxLevelsPerSide ?? 4;

  if (candles.length < swingLookback * 2 + 2) return [];

  const referencePrice = candles[candles.length - 1]!.close;
  const events = computeSwingEvents(candles, swingLookback);
  if (events.length === 0) return [];

  const sorted = [...events].sort((a, b) => a.price - b.price);
  const clusters: { prices: number[]; lastTime: number }[] = [];
  for (const e of sorted) {
    const last = clusters[clusters.length - 1];
    if (last) {
      const avg = last.prices.reduce((a, b) => a + b, 0) / last.prices.length;
      if (avg > 0 && (Math.abs(e.price - avg) / avg) * 100 <= clusterTolerancePct) {
        last.prices.push(e.price);
        last.lastTime = Math.max(last.lastTime, e.time);
        continue;
      }
    }
    clusters.push({ prices: [e.price], lastTime: e.time });
  }

  const levels: KeyLevel[] = clusters.map((c) => {
    const price = c.prices.reduce((a, b) => a + b, 0) / c.prices.length;
    const type: KeyLevel["type"] = price >= referencePrice ? "resistance" : "support";
    const touchCount = c.prices.length;
    return {
      price,
      type,
      touchCount,
      strength: strengthOf(touchCount),
      lastTouchTime: c.lastTime,
      distancePct: ((price - referencePrice) / referencePrice) * 100,
    };
  });

  const support = levels
    .filter((l) => l.type === "support")
    .sort((a, b) => b.price - a.price) // 由近到遠（價格由高到低）
    .slice(0, maxLevelsPerSide);
  const resistance = levels
    .filter((l) => l.type === "resistance")
    .sort((a, b) => a.price - b.price) // 由近到遠（價格由低到高）
    .slice(0, maxLevelsPerSide);

  return [...resistance, ...support].sort((a, b) => b.price - a.price);
}
