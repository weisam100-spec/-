import { describe, it, expect } from "vitest";
import { computeTrendlines } from "@/lib/indicators/trendlines";
import {
  buildNoisyCandles,
  buildCandlesFromCloses,
} from "./fixtures/sampleCandles";

function buildAscendingLowsCloses(): number[] {
  const closes: number[] = [];
  const base = 100;
  for (let cycle = 0; cycle < 4; cycle++) {
    const cycleLow = base + cycle * 5; // 每一輪的低點都比前一輪高（上升低點）
    for (let i = 0; i < 6; i++) closes.push(cycleLow + i * 2); // 從低點往上
    for (let i = 0; i < 6; i++) closes.push(cycleLow + 10 - i * 1.5); // 回落到下一輪（更高）的低點附近
  }
  return closes;
}

function buildDescendingHighsCloses(): number[] {
  const closes: number[] = [];
  const base = 140;
  for (let cycle = 0; cycle < 4; cycle++) {
    const cycleHigh = base - cycle * 5; // 每一輪的高點都比前一輪低（下降高點）
    for (let i = 0; i < 6; i++) closes.push(cycleHigh - i * 2); // 從高點往下
    for (let i = 0; i < 6; i++) closes.push(cycleHigh - 10 + i * 1.5); // 反彈到下一輪（更低）的高點附近
  }
  return closes;
}

describe("computeTrendlines", () => {
  it("資料量過少時回傳 null，而非假造趨勢線", () => {
    const candles = buildNoisyCandles(5, 1);
    const result = computeTrendlines(candles);
    expect(result.uptrend).toBeNull();
    expect(result.downtrend).toBeNull();
  });

  it("連續墊高的低點會被偵測為一條上升趨勢線，終點價格高於起點", () => {
    const candles = buildCandlesFromCloses(buildAscendingLowsCloses());
    const { uptrend } = computeTrendlines(candles, {
      swingLookback: 2,
      tolerancePct: 1,
    });
    expect(uptrend).not.toBeNull();
    expect(uptrend!.endPrice).toBeGreaterThan(uptrend!.startPrice);
    expect(uptrend!.endTime).toBeGreaterThan(uptrend!.startTime);
    expect(uptrend!.touchCount).toBeGreaterThanOrEqual(2);
  });

  it("連續走低的高點會被偵測為一條下降趨勢線，終點價格低於起點", () => {
    const candles = buildCandlesFromCloses(buildDescendingHighsCloses());
    const { downtrend } = computeTrendlines(candles, {
      swingLookback: 2,
      tolerancePct: 1,
    });
    expect(downtrend).not.toBeNull();
    expect(downtrend!.endPrice).toBeLessThan(downtrend!.startPrice);
    expect(downtrend!.touchCount).toBeGreaterThanOrEqual(2);
  });

  it("strength 分級與 touchCount 一致", () => {
    const candles = buildCandlesFromCloses(buildAscendingLowsCloses());
    const { uptrend } = computeTrendlines(candles, {
      swingLookback: 2,
      tolerancePct: 1,
    });
    expect(uptrend).not.toBeNull();
    if (uptrend!.touchCount >= 4) expect(uptrend!.strength).toBe("strong");
    else if (uptrend!.touchCount === 3)
      expect(uptrend!.strength).toBe("medium");
    else expect(uptrend!.strength).toBe("weak");
  });

  it("若候選上升線在期間內被價格明顯跌破，則不會採用那個組合", () => {
    // 前段墊高的低點，後段加入一根價格大幅插破所有候選線的 K 棒
    const closes = buildAscendingLowsCloses();
    const candles = buildCandlesFromCloses(closes);
    // 把最後一根 K 棒的最低價改到遠低於任何可能的上升線延伸值
    const crashed = [...candles];
    crashed[crashed.length - 1] = {
      ...crashed[crashed.length - 1]!,
      low: 1,
      close: 50,
    };

    const { uptrend } = computeTrendlines(crashed, {
      swingLookback: 2,
      tolerancePct: 1,
    });
    // 原本應該成立的上升線，因為最後一根大幅跌破，不應該再被視為「尚未跌破」的有效趨勢線
    expect(uptrend).toBeNull();
  });

  it("純雜訊資料不會拋出例外，回傳結果型別正確（可能為 null 或合法物件）", () => {
    const candles = buildNoisyCandles(400, 21);
    const { uptrend, downtrend } = computeTrendlines(candles);
    for (const line of [uptrend, downtrend]) {
      if (line) {
        expect(Number.isFinite(line.startPrice)).toBe(true);
        expect(Number.isFinite(line.endPrice)).toBe(true);
        expect(line.endTime).toBeGreaterThan(line.startTime);
      }
    }
  });
});
