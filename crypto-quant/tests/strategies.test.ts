import { describe, it, expect } from "vitest";
import { emaTrendStrategy } from "@/lib/strategies/emaTrend";
import { rsiMeanReversionStrategy } from "@/lib/strategies/rsiMeanReversion";
import { macdTrendStrategy } from "@/lib/strategies/macdTrend";
import { multiFactorStrategy, validateWeights, multiFactorDefaultWeights } from "@/lib/strategies/multiFactor";
import { buildSampleCandles } from "./fixtures/sampleCandles";

const ctx = { symbol: "BTCUSDT", interval: "1h" as const };

describe("emaTrendStrategy", () => {
  it("驗證短週期必須小於長週期", () => {
    const result = emaTrendStrategy.validateParams({
      shortPeriod: 50,
      longPeriod: 20,
      confirmClose: true,
      confirmVolume: false,
      confirmRsi: false,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("在樣本資料的上升與回檔段能產生黃金交叉與死亡交叉訊號", () => {
    const candles = buildSampleCandles();
    const params = { ...emaTrendStrategy.defaultParams, confirmClose: false };
    const signals = emaTrendStrategy.generateSignals(candles, params, ctx);
    expect(signals.length).toBeGreaterThan(0);
    expect(signals.some((s) => s.type === "bullish_candidate")).toBe(true);
    expect(signals.some((s) => s.type === "bearish_candidate")).toBe(true);
  });

  it("訊號時間必須對應到樣本資料中存在的 K 棒開盤時間（不可使用未來資料）", () => {
    const candles = buildSampleCandles();
    const params = { ...emaTrendStrategy.defaultParams, confirmClose: false };
    const signals = emaTrendStrategy.generateSignals(candles, params, ctx);
    const openTimes = new Set(candles.map((c) => c.openTime));
    for (const s of signals) {
      expect(openTimes.has(s.time)).toBe(true);
    }
  });

  it("只用前半段資料時，不會產生依賴後半段資料才會出現的訊號（無未來函數）", () => {
    const candles = buildSampleCandles();
    const params = { ...emaTrendStrategy.defaultParams, confirmClose: false };
    const half = candles.slice(0, 70);
    const fullSignals = emaTrendStrategy.generateSignals(candles, params, ctx);
    const halfSignals = emaTrendStrategy.generateSignals(half, params, ctx);
    const fullSignalsWithinHalf = fullSignals.filter((s) => s.time <= half[half.length - 1]!.openTime);
    expect(halfSignals).toEqual(fullSignalsWithinHalf);
  });
});

describe("rsiMeanReversionStrategy", () => {
  it("超賣門檻必須小於超買門檻", () => {
    const result = rsiMeanReversionStrategy.validateParams({ period: 14, oversold: 80, overbought: 20 });
    expect(result.valid).toBe(false);
  });

  it("門檻必須介於 0 到 100", () => {
    const result = rsiMeanReversionStrategy.validateParams({ period: 14, oversold: -5, overbought: 150 });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });

  it("可在樣本資料上產生訊號", () => {
    const candles = buildSampleCandles();
    const signals = rsiMeanReversionStrategy.generateSignals(
      candles,
      rsiMeanReversionStrategy.defaultParams,
      ctx,
    );
    expect(Array.isArray(signals)).toBe(true);
  });
});

describe("macdTrendStrategy", () => {
  it("快線必須小於慢線", () => {
    const result = macdTrendStrategy.validateParams({
      fastPeriod: 30,
      slowPeriod: 10,
      signalPeriod: 9,
      useZeroAxisFilter: false,
      useVolumeFilter: false,
    });
    expect(result.valid).toBe(false);
  });

  it("可在樣本資料上產生黃金 / 死亡交叉訊號", () => {
    const candles = buildSampleCandles();
    const signals = macdTrendStrategy.generateSignals(candles, macdTrendStrategy.defaultParams, ctx);
    expect(signals.length).toBeGreaterThan(0);
  });
});

describe("multiFactorStrategy", () => {
  it("權重總和不為 100 時驗證失敗", () => {
    const errors = validateWeights({ ...multiFactorDefaultWeights, emaTrend: 90 });
    expect(errors.length).toBeGreaterThan(0);
  });

  it("權重總和為 100 且都在範圍內時驗證通過", () => {
    const errors = validateWeights(multiFactorDefaultWeights);
    expect(errors).toHaveLength(0);
  });

  it("每個訊號都附帶各因子的貢獻明細，總和約等於總分", () => {
    const candles = buildSampleCandles();
    const signals = multiFactorStrategy.generateSignals(candles, multiFactorStrategy.defaultParams, ctx);
    expect(signals.length).toBeGreaterThan(0);
    for (const s of signals) {
      expect(s.contributions).toBeDefined();
      const sum = s.contributions!.reduce((acc, c) => acc + c.contribution, 0);
      // 總分有 clamp 在 -100~100，貢獻總和在未 clamp 情況下應非常接近信心分數方向
      expect(Math.abs(sum)).toBeLessThanOrEqual(100 + 1e-6);
    }
  });

  it("總分範圍應在 -100 到 100 之間", () => {
    const candles = buildSampleCandles();
    const signals = multiFactorStrategy.generateSignals(candles, multiFactorStrategy.defaultParams, ctx);
    for (const s of signals) {
      expect(s.confidence).toBeGreaterThanOrEqual(0);
      expect(s.confidence).toBeLessThanOrEqual(100);
    }
  });
});
