import { describe, it, expect } from "vitest";
import { detectOrderBlocks } from "@/lib/strategies/orderBlockDetection";
import { computeOrderBlocks } from "@/lib/indicators/orderBlocks";
import { smcStrategy } from "@/lib/strategies/smc";
import {
  buildSmcScenarioCandles,
  buildNoisyCandles,
  buildSampleCandles,
} from "./fixtures/sampleCandles";

const ctx = { symbol: "BTCUSDT", interval: "1h" as const };
const scenarioParams = {
  ...smcStrategy.defaultParams,
  swingLookback: 2,
  minDisplacementMultiple: 1.2,
  orderBlockLookback: 10,
};

describe("detectOrderBlocks", () => {
  it("資料量過少時回傳空結果", () => {
    const result = detectOrderBlocks(buildNoisyCandles(5, 1), scenarioParams);
    expect(result.touches).toEqual([]);
    expect(result.active).toEqual([]);
  });

  it("訂單塊被突破建立後、尚未被回測前，會出現在 active 清單", () => {
    const candles = buildSmcScenarioCandles();
    // 索引 25 為突破 K 棒（建立訂單塊），索引 28 才觸發回測；截到 26 可以看到「尚未回測」的狀態
    const beforeTouch = candles.slice(0, 27);
    const result = detectOrderBlocks(beforeTouch, scenarioParams);
    expect(result.touches).toEqual([]);
    expect(result.active.length).toBeGreaterThanOrEqual(1);
    expect(result.active[0]!.type).toBe("bullish");
    expect(result.active[0]!.isChoch).toBe(true);
  });

  it("訂單塊被價格回測後，就不會再出現在 active 清單，而是出現在 touches", () => {
    const candles = buildSmcScenarioCandles();
    const result = detectOrderBlocks(candles, scenarioParams);
    expect(result.touches.length).toBeGreaterThanOrEqual(1);
    const touchedBlock = result.touches[0]!;
    const stillActive = result.active.some(
      (a) => a.low === touchedBlock.low && a.high === touchedBlock.high,
    );
    expect(stillActive).toBe(false);
  });

  it("超過有效期（maxMitigationBars）仍未被回測的訂單塊會從 active 清單移除", () => {
    // 訂單塊於索引 25 建立；maxMitigationBars=0 代表建立下一根（索引 26）就視為過期
    const candles = buildSmcScenarioCandles().slice(0, 27);
    const shortLived = { ...scenarioParams, maxMitigationBars: 0 };
    const result = detectOrderBlocks(candles, shortLived);
    expect(result.active).toEqual([]);
  });

  it("SMC 策略的訊號數與 detectOrderBlocks 的 touches 數一致（共用同一套邏輯）", () => {
    const candles = buildSmcScenarioCandles();
    const signals = smcStrategy.generateSignals(candles, scenarioParams, ctx);
    const { touches } = detectOrderBlocks(candles, scenarioParams);
    expect(signals.length).toBe(touches.length);
    expect(signals.map((s) => s.time)).toEqual(touches.map((t) => t.time));
  });
});

describe("computeOrderBlocks（行情頁顯示用）", () => {
  it("沒有資料時回傳空陣列", () => {
    expect(computeOrderBlocks([])).toEqual([]);
  });

  it("回傳的區塊 endTime 一律延伸到最新一根 K 棒", () => {
    const candles = buildNoisyCandles(400, 5);
    const blocks = computeOrderBlocks(candles);
    const lastTime = candles[candles.length - 1]!.openTime;
    for (const b of blocks) {
      expect(b.endTime).toBe(lastTime);
      expect(b.high).toBeGreaterThanOrEqual(b.low);
      expect(b.startTime).toBeLessThan(b.endTime);
    }
  });

  it("最多回傳 maxBlocks 個區塊", () => {
    const candles = buildSampleCandles();
    const blocks = computeOrderBlocks(candles, 2);
    expect(blocks.length).toBeLessThanOrEqual(2);
  });
});
