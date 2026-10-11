import { describe, it, expect } from "vitest";
import { computeKeyLevels } from "@/lib/indicators/supportResistance";
import { buildNoisyCandles, buildCandlesFromCloses } from "./fixtures/sampleCandles";

describe("computeKeyLevels", () => {
  it("資料量過少時回傳空陣列，而非假造價位", () => {
    const candles = buildNoisyCandles(5, 1);
    expect(computeKeyLevels(candles)).toEqual([]);
  });

  it("壓力價位一律高於（或等於）目前收盤價，支撐價位一律低於目前收盤價", () => {
    const candles = buildNoisyCandles(300, 3);
    const referencePrice = candles[candles.length - 1]!.close;
    const levels = computeKeyLevels(candles);
    for (const level of levels) {
      if (level.type === "resistance") expect(level.price).toBeGreaterThanOrEqual(referencePrice);
      else expect(level.price).toBeLessThan(referencePrice);
    }
  });

  it("distancePct 的正負號與類型一致：壓力為正，支撐為負", () => {
    const candles = buildNoisyCandles(300, 4);
    const levels = computeKeyLevels(candles);
    for (const level of levels) {
      if (level.type === "resistance") expect(level.distancePct).toBeGreaterThanOrEqual(0);
      else expect(level.distancePct).toBeLessThan(0);
    }
  });

  it("多次在相近價位出現的擺動點會被聚合成同一個價位，touchCount 大於 1", () => {
    // 建構一段在同一價格區間反覆測試高點的走勢，確保該區間會被偵測為多次觸及的壓力位
    const closes: number[] = [];
    const price = 100;
    for (let cycle = 0; cycle < 4; cycle++) {
      for (let i = 0; i < 6; i++) closes.push(price + i * 2); // 上升到高點附近
      for (let i = 0; i < 6; i++) closes.push(price + 10 - i * 2.5); // 從高點附近回落
    }
    // 收尾走勢往下，確保最後收盤價明顯低於前面反覆測試的高點，使其歸類為壓力
    for (let i = 0; i < 10; i++) closes.push(price - i * 1.5);
    const candles = buildCandlesFromCloses(closes);

    const levels = computeKeyLevels(candles, { swingLookback: 2, clusterTolerancePct: 3 });
    expect(levels.some((l) => l.touchCount >= 2)).toBe(true);
  });

  it("每側最多回傳 maxLevelsPerSide 個價位", () => {
    const candles = buildNoisyCandles(500, 9);
    const levels = computeKeyLevels(candles, { swingLookback: 2, maxLevelsPerSide: 2 });
    const resistanceCount = levels.filter((l) => l.type === "resistance").length;
    const supportCount = levels.filter((l) => l.type === "support").length;
    expect(resistanceCount).toBeLessThanOrEqual(2);
    expect(supportCount).toBeLessThanOrEqual(2);
  });

  it("結果依價格由高到低排序", () => {
    const candles = buildNoisyCandles(300, 11);
    const levels = computeKeyLevels(candles);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i - 1]!.price).toBeGreaterThanOrEqual(levels[i]!.price);
    }
  });

  it("strength 分級與 touchCount 一致", () => {
    const candles = buildNoisyCandles(400, 13);
    const levels = computeKeyLevels(candles, { swingLookback: 2 });
    for (const level of levels) {
      if (level.touchCount >= 3) expect(level.strength).toBe("strong");
      else if (level.touchCount === 2) expect(level.strength).toBe("medium");
      else expect(level.strength).toBe("weak");
    }
  });
});
