import { describe, it, expect } from "vitest";
import { computeLevelReactionStats } from "@/lib/indicators/levelProbability";
import { computeKeyLevels } from "@/lib/indicators/supportResistance";
import {
  buildCandlesFromCloses,
  buildNoisyCandles,
} from "./fixtures/sampleCandles";
import type { KeyLevel } from "@/lib/indicators/supportResistance";

function level(overrides: Partial<KeyLevel> = {}): KeyLevel {
  return {
    price: 100,
    type: "resistance",
    touchCount: 1,
    strength: "weak",
    lastTouchTime: 0,
    distancePct: 0,
    ...overrides,
  };
}

describe("computeLevelReactionStats", () => {
  it("沒有任何觸及時，upProbabilityPct 為 null，touchCount 為 0", () => {
    const candles = buildCandlesFromCloses([
      10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    ]);
    const stats = computeLevelReactionStats(candles, [level({ price: 500 })], {
      lookForwardBars: 3,
    });
    expect(stats[0]!.touchCount).toBe(0);
    expect(stats[0]!.upProbabilityPct).toBeNull();
  });

  it("每次觸及後都上漲時，upProbabilityPct 為 100", () => {
    // 價格在 100 附近觸及後，之後都明確走高，中間間隔夠遠避免被冷卻期合併
    const closes = [100, 110, 120, 130, 100, 140, 150, 160, 100, 170, 180, 190];
    const candles = buildCandlesFromCloses(closes);
    const stats = computeLevelReactionStats(candles, [level({ price: 100 })], {
      lookForwardBars: 2,
      tolerancePct: 1,
      cooldownBars: 2,
    });
    expect(stats[0]!.touchCount).toBeGreaterThan(0);
    expect(stats[0]!.upProbabilityPct).toBe(100);
    expect(stats[0]!.downCount).toBe(0);
  });

  it("每次觸及後都下跌時，upProbabilityPct 為 0", () => {
    const closes = [100, 90, 80, 70, 100, 60, 50, 40, 100, 30, 20, 10];
    const candles = buildCandlesFromCloses(closes);
    const stats = computeLevelReactionStats(candles, [level({ price: 100 })], {
      lookForwardBars: 2,
      tolerancePct: 1,
      cooldownBars: 2,
    });
    expect(stats[0]!.touchCount).toBeGreaterThan(0);
    expect(stats[0]!.upProbabilityPct).toBe(0);
    expect(stats[0]!.upCount).toBe(0);
  });

  it("連續貼著同一價位的 K 棒只會算一次觸及（冷卻期內不重複計算）", () => {
    // 連續 5 根都貼在 100 附近，之後才真正脫離
    const closes = [100, 100.1, 99.9, 100.2, 99.8, 150, 160];
    const candles = buildCandlesFromCloses(closes);
    const stats = computeLevelReactionStats(candles, [level({ price: 100 })], {
      lookForwardBars: 1,
      tolerancePct: 1,
      cooldownBars: 10,
    });
    expect(stats[0]!.touchCount).toBe(1);
  });

  it("upCount + downCount 等於 touchCount", () => {
    const candles = buildNoisyCandles(300, 7);
    const levels = computeKeyLevels(candles);
    const stats = computeLevelReactionStats(candles, levels);
    for (const s of stats) {
      expect(s.upCount + s.downCount).toBe(s.touchCount);
      if (s.touchCount > 0) {
        expect(s.upProbabilityPct).toBeGreaterThanOrEqual(0);
        expect(s.upProbabilityPct).toBeLessThanOrEqual(100);
      }
    }
  });

  it("回傳的陣列長度與輸入的 levels 長度一致，且順序一致", () => {
    const candles = buildNoisyCandles(300, 9);
    const levels = computeKeyLevels(candles);
    const stats = computeLevelReactionStats(candles, levels);
    expect(stats.length).toBe(levels.length);
    expect(stats.map((s) => s.level.price)).toEqual(levels.map((l) => l.price));
  });
});
