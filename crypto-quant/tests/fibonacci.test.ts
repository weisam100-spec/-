import { describe, it, expect } from "vitest";
import { computeFibonacciRetracement } from "@/lib/indicators/fibonacci";
import {
  buildCandlesFromCloses,
  buildNoisyCandles,
} from "./fixtures/sampleCandles";

describe("computeFibonacciRetracement", () => {
  it("資料量過少時回傳 null，而非假造水平", () => {
    const candles = buildCandlesFromCloses([100, 101, 102]);
    expect(computeFibonacciRetracement(candles)).toBeNull();
  });

  it("近期走勢為上升段（低點在前、高點在後）時，以高點、低點為兩端計算回檔", () => {
    const closes = [100, 95, 90, 95, 100, 110, 120, 130, 125, 128]; // 低點在 idx2(90)，高點在 idx7(130)
    const candles = buildCandlesFromCloses(closes);
    const result = computeFibonacciRetracement(candles, {
      lookback: closes.length,
      ratios: [0, 1],
    });
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("retracement_down");
    const level0 = result!.levels.find((l) => l.ratio === 0)!;
    const level100 = result!.levels.find((l) => l.ratio === 1)!;
    expect(level0.price).toBeCloseTo(result!.anchorHighPrice, 6);
    expect(level100.price).toBeCloseTo(result!.anchorLowPrice, 6);
  });

  it("近期走勢為下降段（高點在前、低點在後）時，以低點、高點為兩端計算回檔", () => {
    const closes = [100, 110, 120, 130, 125, 120, 110, 100, 90, 95]; // 高點在 idx3(130)，低點在 idx8(90)
    const candles = buildCandlesFromCloses(closes);
    const result = computeFibonacciRetracement(candles, {
      lookback: closes.length,
      ratios: [0, 1],
    });
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("retracement_up");
    const level0 = result!.levels.find((l) => l.ratio === 0)!;
    const level100 = result!.levels.find((l) => l.ratio === 1)!;
    expect(level0.price).toBeCloseTo(result!.anchorLowPrice, 6);
    expect(level100.price).toBeCloseTo(result!.anchorHighPrice, 6);
  });

  it("所有水平線的價格都落在最高點與最低點之間（含端點）", () => {
    const candles = buildNoisyCandles(300, 3);
    const result = computeFibonacciRetracement(candles);
    expect(result).not.toBeNull();
    const min = Math.min(result!.anchorHighPrice, result!.anchorLowPrice);
    const max = Math.max(result!.anchorHighPrice, result!.anchorLowPrice);
    for (const level of result!.levels) {
      expect(level.price).toBeGreaterThanOrEqual(min - 1e-6);
      expect(level.price).toBeLessThanOrEqual(max + 1e-6);
    }
  });

  it("預設回傳 4 個核心比例水平", () => {
    const candles = buildNoisyCandles(300, 4);
    const result = computeFibonacciRetracement(candles);
    expect(result).not.toBeNull();
    const ratios = result!.levels.map((l) => l.ratio);
    expect(ratios).toEqual([0.236, 0.382, 0.5, 0.618]);
  });

  it("完全沒有波動（高低點相同）時回傳 null", () => {
    const candles = buildCandlesFromCloses(Array(10).fill(100)).map((c) => ({
      ...c,
      high: 100,
      low: 100,
    }));
    expect(computeFibonacciRetracement(candles)).toBeNull();
  });

  it("lookback 只會取最近視窗內的極值，較舊的極端值不會被採用", () => {
    // 前段有一個極端高點，但不在 lookback 視窗內；近期視窗內走勢相對平緩
    const closes = [500, 100, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109];
    const candles = buildCandlesFromCloses(closes);
    const result = computeFibonacciRetracement(candles, { lookback: 6 });
    expect(result).not.toBeNull();
    expect(result!.anchorHighPrice).toBeLessThan(500);
  });
});
