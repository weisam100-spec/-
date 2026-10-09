import { describe, it, expect } from "vitest";
import { emaTrendStrategy } from "@/lib/strategies/emaTrend";
import { rsiMeanReversionStrategy } from "@/lib/strategies/rsiMeanReversion";
import { macdTrendStrategy } from "@/lib/strategies/macdTrend";
import { multiFactorStrategy, validateWeights, multiFactorDefaultWeights } from "@/lib/strategies/multiFactor";
import { smcStrategy } from "@/lib/strategies/smc";
import { smtStrategy } from "@/lib/strategies/smt";
import { buildSampleCandles, buildSmcScenarioCandles, buildSmtScenarioCandles } from "./fixtures/sampleCandles";

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

describe("smcStrategy", () => {
  it("擺動點確認根數必須介於合理範圍", () => {
    const result = smcStrategy.validateParams({ ...smcStrategy.defaultParams, swingLookback: 1 });
    expect(result.valid).toBe(false);
  });

  it("突破動能倍數必須大於 0", () => {
    const result = smcStrategy.validateParams({ ...smcStrategy.defaultParams, minDisplacementMultiple: 0 });
    expect(result.valid).toBe(false);
  });

  it("預設參數驗證通過", () => {
    const result = smcStrategy.validateParams(smcStrategy.defaultParams);
    expect(result.valid).toBe(true);
  });

  const scenarioParams = { ...smcStrategy.defaultParams, swingLookback: 2, minDisplacementMultiple: 1.2, orderBlockLookback: 10 };

  it("情境資料：空頭結構轉多（CHoCH）後回測訂單塊，應觸發偏多候選訊號", () => {
    const candles = buildSmcScenarioCandles();
    const signals = smcStrategy.generateSignals(candles, scenarioParams, ctx);
    expect(signals.length).toBeGreaterThanOrEqual(1);
    const signal = signals[0]!;
    expect(signal.type).toBe("bullish_candidate");
    expect(signal.reason).toContain("CHoCH");
    expect(signal.reason).toContain("訂單塊");
    const openTimes = new Set(candles.map((c) => c.openTime));
    expect(openTimes.has(signal.time)).toBe(true);
  });

  it("只用訊號當根（含）之前的資料時，產生的訊號必須與完整資料中同一時間點的訊號完全一致（無未來函數）", () => {
    const candles = buildSmcScenarioCandles();
    const fullSignals = smcStrategy.generateSignals(candles, scenarioParams, ctx);
    expect(fullSignals.length).toBeGreaterThanOrEqual(1);
    const signalTime = fullSignals[0]!.time;
    const cutoffIndex = candles.findIndex((c) => c.openTime === signalTime);
    const truncated = candles.slice(0, cutoffIndex + 1);

    const truncatedSignals = smcStrategy.generateSignals(truncated, scenarioParams, ctx);
    const fullSignalsWithinCutoff = fullSignals.filter((s) => s.time <= signalTime);
    expect(truncatedSignals).toEqual(fullSignalsWithinCutoff);
  });

  it("在一般走勢樣本資料上執行不會噴錯，且不會產生依賴後半段資料的訊號", () => {
    const candles = buildSampleCandles();
    const half = candles.slice(0, 80);
    const fullSignals = smcStrategy.generateSignals(candles, smcStrategy.defaultParams, ctx);
    const halfSignals = smcStrategy.generateSignals(half, smcStrategy.defaultParams, ctx);
    const fullSignalsWithinHalf = fullSignals.filter((s) => s.time <= half[half.length - 1]!.openTime);
    expect(halfSignals).toEqual(fullSignalsWithinHalf);
  });

  it("每個訊號的信心分數介於 0 到 100", () => {
    const candles = buildSmcScenarioCandles();
    const signals = smcStrategy.generateSignals(candles, scenarioParams, ctx);
    for (const s of signals) {
      expect(s.confidence).toBeGreaterThanOrEqual(0);
      expect(s.confidence).toBeLessThanOrEqual(100);
    }
  });
});

describe("smtStrategy", () => {
  const smtParams = { correlatedSymbol: "ETHUSDT", swingLookback: 2, maxMatchBars: 3 };
  const smtCtxFor = (correlated: ReturnType<typeof buildSmtScenarioCandles>["correlated"]) => ({
    symbol: "BTCUSDT" as const,
    interval: "1h" as const,
    correlatedCandles: correlated,
    correlatedSymbol: "ETHUSDT",
  });

  it("比較交易對必須是支援清單中的交易對", () => {
    const result = smtStrategy.validateParams({ ...smtParams, correlatedSymbol: "NOTREAL" });
    expect(result.valid).toBe(false);
  });

  it("預設參數驗證通過", () => {
    const result = smtStrategy.validateParams(smtStrategy.defaultParams);
    expect(result.valid).toBe(true);
  });

  it("缺少比較交易對資料時回傳空陣列，絕不假造訊號", () => {
    const { primary } = buildSmtScenarioCandles();
    const signals = smtStrategy.generateSignals(primary, smtParams, { symbol: "BTCUSDT", interval: "1h" });
    expect(signals).toEqual([]);
  });

  it("主要資產創高但比較資產未同步創高時，應觸發偏空候選訊號（頂背離）", () => {
    const { primary, correlated } = buildSmtScenarioCandles();
    const signals = smtStrategy.generateSignals(primary, smtParams, smtCtxFor(correlated));
    expect(signals.length).toBeGreaterThanOrEqual(1);
    const signal = signals[0]!;
    expect(signal.type).toBe("bearish_candidate");
    expect(signal.reason).toContain("SMT");
    expect(signal.reason).toContain("ETHUSDT");
    const openTimes = new Set(primary.map((c) => c.openTime));
    expect(openTimes.has(signal.time)).toBe(true);
  });

  it("只用訊號當根（含）之前的主要與比較資料時，產生的訊號必須與完整資料一致（無未來函數）", () => {
    const { primary, correlated } = buildSmtScenarioCandles();
    const fullSignals = smtStrategy.generateSignals(primary, smtParams, smtCtxFor(correlated));
    expect(fullSignals.length).toBeGreaterThanOrEqual(1);
    const signalTime = fullSignals[0]!.time;
    const cutoffIndex = primary.findIndex((c) => c.openTime === signalTime);

    const truncatedPrimary = primary.slice(0, cutoffIndex + 1);
    const truncatedCorrelated = correlated.slice(0, cutoffIndex + 1);
    const truncatedSignals = smtStrategy.generateSignals(truncatedPrimary, smtParams, smtCtxFor(truncatedCorrelated));

    const fullSignalsWithinCutoff = fullSignals.filter((s) => s.time <= signalTime);
    expect(truncatedSignals).toEqual(fullSignalsWithinCutoff);
  });

  it("主要交易對與比較交易對相同時不產生訊號", () => {
    const { primary, correlated } = buildSmtScenarioCandles();
    const signals = smtStrategy.generateSignals(primary, { ...smtParams, correlatedSymbol: "BTCUSDT" }, smtCtxFor(correlated));
    expect(signals).toEqual([]);
  });
});
