import { describe, it, expect } from "vitest";
import { dailyReferenceLineStrategy } from "@/lib/strategies/dailyReferenceLine";
import { buildCandlesFromCloses, buildSampleCandles } from "./fixtures/sampleCandles";

const ctx = { symbol: "BTCUSDT", interval: "1h" as const };

// Taipei (UTC+8) 時間 2024/01/01 09:00 = UTC 2024/01/01 01:00
const TAIPEI_09_00_UTC_MS = Date.UTC(2024, 0, 1, 1, 0, 0);

/**
 * 以 1 小時一根建構一段跨越台北曆日的情境資料，索引 0 從台北時間 01/01 09:00 開始：
 * idx0~2：09:00~11:00（基準時刻之前）
 * idx3：12:00（基準 K 棒，收盤 103）
 * idx4：13:00（貼著基準價，103，尚未形成「前一狀態」）
 * idx5：14:00（110，明顯站上基準價 → 偏多候選訊號）
 * idx6：15:00（112，持續在上方，不重複觸發）
 * idx7：16:00（95，明顯跌破基準價 → 偏空候選訊號）
 * idx8~14：17:00~23:00（持續在下方）
 * idx15：次日 00:00（200，劇烈變動但次日基準尚未確立，不應觸發）
 * idx16：次日 01:00（10，同樣不應觸發）
 */
function buildScenarioCandles() {
  const closes = [100, 101, 102, 103, 103, 110, 112, 95, 90, 85, 80, 75, 70, 65, 60, 200, 10];
  return buildCandlesFromCloses(closes, TAIPEI_09_00_UTC_MS, 3_600_000);
}

const scenarioParams = { ...dailyReferenceLineStrategy.defaultParams, cooldownBars: 1 };

describe("dailyReferenceLineStrategy", () => {
  it("基準時間小時數超出範圍時驗證失敗", () => {
    const result = dailyReferenceLineStrategy.validateParams({
      ...dailyReferenceLineStrategy.defaultParams,
      anchorHour: 24,
    });
    expect(result.valid).toBe(false);
  });

  it("基準時間分鐘數超出範圍時驗證失敗", () => {
    const result = dailyReferenceLineStrategy.validateParams({
      ...dailyReferenceLineStrategy.defaultParams,
      anchorMinute: 60,
    });
    expect(result.valid).toBe(false);
  });

  it("冷卻根數為負數時驗證失敗", () => {
    const result = dailyReferenceLineStrategy.validateParams({
      ...dailyReferenceLineStrategy.defaultParams,
      cooldownBars: -1,
    });
    expect(result.valid).toBe(false);
  });

  it("預設參數驗證通過", () => {
    const result = dailyReferenceLineStrategy.validateParams(dailyReferenceLineStrategy.defaultParams);
    expect(result.valid).toBe(true);
  });

  it("情境資料：站上當日基準價觸發偏多候選訊號，跌破觸發偏空候選訊號", () => {
    const candles = buildScenarioCandles();
    const signals = dailyReferenceLineStrategy.generateSignals(candles, scenarioParams, ctx);
    expect(signals.length).toBe(2);
    expect(signals[0]!.type).toBe("bullish_candidate");
    expect(signals[0]!.time).toBe(candles[5]!.openTime);
    expect(signals[0]!.reason).toContain("站上");
    expect(signals[1]!.type).toBe("bearish_candidate");
    expect(signals[1]!.time).toBe(candles[7]!.openTime);
    expect(signals[1]!.reason).toContain("跌破");
  });

  it("基準 K 棒本身與緊接著的下一根都不會觸發訊號（需先建立前一狀態）", () => {
    const candles = buildScenarioCandles();
    const signals = dailyReferenceLineStrategy.generateSignals(candles, scenarioParams, ctx);
    const times = signals.map((s) => s.time);
    expect(times).not.toContain(candles[3]!.openTime);
    expect(times).not.toContain(candles[4]!.openTime);
  });

  it("換日後會重設基準價，次日基準時刻之前即使價格劇烈變動也不會觸發訊號", () => {
    const candles = buildScenarioCandles();
    const signals = dailyReferenceLineStrategy.generateSignals(candles, scenarioParams, ctx);
    const times = signals.map((s) => s.time);
    expect(times).not.toContain(candles[15]!.openTime);
    expect(times).not.toContain(candles[16]!.openTime);
  });

  it("冷卻根數設定較大時，相鄰太近的訊號會被抑制", () => {
    const candles = buildScenarioCandles();
    const signals = dailyReferenceLineStrategy.generateSignals(
      candles,
      { ...dailyReferenceLineStrategy.defaultParams, cooldownBars: 10 },
      ctx,
    );
    // idx5 與 idx7 只間隔 2 根，預設冷卻根數為 5（這裡設 10）會抑制第二個訊號
    expect(signals.length).toBe(1);
    expect(signals[0]!.type).toBe("bullish_candidate");
  });

  it("只用訊號當根（含）之前的資料時，產生的訊號必須與完整資料中同一時間點的訊號完全一致（無未來函數）", () => {
    const candles = buildScenarioCandles();
    const fullSignals = dailyReferenceLineStrategy.generateSignals(candles, scenarioParams, ctx);
    expect(fullSignals.length).toBeGreaterThanOrEqual(1);
    const signalTime = fullSignals[0]!.time;
    const cutoffIndex = candles.findIndex((c) => c.openTime === signalTime);
    const truncated = candles.slice(0, cutoffIndex + 1);

    const truncatedSignals = dailyReferenceLineStrategy.generateSignals(truncated, scenarioParams, ctx);
    const fullSignalsWithinCutoff = fullSignals.filter((s) => s.time <= signalTime);
    expect(truncatedSignals).toEqual(fullSignalsWithinCutoff);
  });

  it("在一般走勢樣本資料上執行不會噴錯，且不會產生依賴後半段資料的訊號", () => {
    const candles = buildSampleCandles();
    const half = candles.slice(0, 80);
    const fullSignals = dailyReferenceLineStrategy.generateSignals(candles, dailyReferenceLineStrategy.defaultParams, ctx);
    const halfSignals = dailyReferenceLineStrategy.generateSignals(half, dailyReferenceLineStrategy.defaultParams, ctx);
    const fullSignalsWithinHalf = fullSignals.filter((s) => s.time <= half[half.length - 1]!.openTime);
    expect(halfSignals).toEqual(fullSignalsWithinHalf);
  });

  it("每個訊號的信心分數介於 0 到 100", () => {
    const candles = buildScenarioCandles();
    const signals = dailyReferenceLineStrategy.generateSignals(candles, scenarioParams, ctx);
    for (const s of signals) {
      expect(s.confidence).toBeGreaterThanOrEqual(0);
      expect(s.confidence).toBeLessThanOrEqual(100);
    }
  });

  it("日線等粗週期資料（每根橫跨一整天）通常不會產生訊號，但不會拋出例外", () => {
    const candles = buildCandlesFromCloses([100, 101, 102, 103, 104], TAIPEI_09_00_UTC_MS, 86_400_000);
    expect(() => dailyReferenceLineStrategy.generateSignals(candles, dailyReferenceLineStrategy.defaultParams, ctx)).not.toThrow();
  });
});
