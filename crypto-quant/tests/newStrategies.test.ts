import { describe, it, expect } from "vitest";
import { trendPullbackEmaStrategy } from "@/lib/strategies/trendPullbackEma";
import { breakoutRetestStrategy } from "@/lib/strategies/breakoutRetest";
import { rangeReversalStrategy } from "@/lib/strategies/rangeReversal";
import { bollingerRsiReversionStrategy } from "@/lib/strategies/bollingerRsiReversion";
import { rsiDivergenceStructureStrategy } from "@/lib/strategies/rsiDivergenceStructure";
import { vwapPullbackStrategy } from "@/lib/strategies/vwapPullback";
import { falseBreakoutReclaimStrategy } from "@/lib/strategies/falseBreakoutReclaim";
import { buildNoisyCandles } from "./fixtures/sampleCandles";
import type { Strategy, StrategySignal } from "@/lib/strategies/types";

const ctx = { symbol: "BTCUSDT", interval: "1h" as const };

/** 共用檢查：訊號時間必須對應存在的 K 棒、信心分數介於 0~100、型態必為多/空候選 */
function assertWellFormedSignals(signals: StrategySignal[], openTimes: Set<number>) {
  for (const s of signals) {
    expect(openTimes.has(s.time)).toBe(true);
    expect(["bullish_candidate", "bearish_candidate"]).toContain(s.type);
    expect(s.confidence).toBeGreaterThanOrEqual(0);
    expect(s.confidence).toBeLessThanOrEqual(100);
  }
}

/** 共用無未來函數驗證：只用訊號當根（含）之前的資料，結果必須與完整資料中同一區段完全一致 */
function assertNoLookahead<P extends Record<string, unknown>>(strategy: Strategy<P>, params: P) {
  const candles = buildNoisyCandles();
  const fullSignals = strategy.generateSignals(candles, params, ctx);
  expect(fullSignals.length).toBeGreaterThan(0);

  const signalTime = fullSignals[Math.floor(fullSignals.length / 2)]!.time;
  const cutoffIndex = candles.findIndex((c) => c.openTime === signalTime);
  const truncated = candles.slice(0, cutoffIndex + 1);

  const truncatedSignals = strategy.generateSignals(truncated, params, ctx);
  const fullSignalsWithinCutoff = fullSignals.filter((s) => s.time <= signalTime);
  expect(truncatedSignals).toEqual(fullSignalsWithinCutoff);
}

describe("trendPullbackEmaStrategy", () => {
  it("短週期必須小於長週期", () => {
    const result = trendPullbackEmaStrategy.validateParams({
      ...trendPullbackEmaStrategy.defaultParams,
      emaShortPeriod: 50,
      emaLongPeriod: 20,
    });
    expect(result.valid).toBe(false);
  });

  it("可在含噪音資料上產生訊號，格式正確", () => {
    const candles = buildNoisyCandles();
    const signals = trendPullbackEmaStrategy.generateSignals(candles, trendPullbackEmaStrategy.defaultParams, ctx);
    expect(signals.length).toBeGreaterThan(0);
    assertWellFormedSignals(signals, new Set(candles.map((c) => c.openTime)));
  });

  it("無未來函數", () => {
    assertNoLookahead(trendPullbackEmaStrategy, trendPullbackEmaStrategy.defaultParams);
  });
});

describe("breakoutRetestStrategy", () => {
  it("回測容許距離必須大於 0", () => {
    const result = breakoutRetestStrategy.validateParams({ ...breakoutRetestStrategy.defaultParams, retestTolerancePct: 0 });
    expect(result.valid).toBe(false);
  });

  it("可在含噪音資料上產生訊號，格式正確", () => {
    const candles = buildNoisyCandles();
    const signals = breakoutRetestStrategy.generateSignals(candles, breakoutRetestStrategy.defaultParams, ctx);
    expect(signals.length).toBeGreaterThan(0);
    assertWellFormedSignals(signals, new Set(candles.map((c) => c.openTime)));
  });

  it("無未來函數", () => {
    assertNoLookahead(breakoutRetestStrategy, breakoutRetestStrategy.defaultParams);
  });
});

describe("rangeReversalStrategy", () => {
  it("觸及容許距離必須介於 0 至 10% 之間", () => {
    const result = rangeReversalStrategy.validateParams({ ...rangeReversalStrategy.defaultParams, touchTolerancePct: 20 });
    expect(result.valid).toBe(false);
  });

  it("可在含噪音資料上產生訊號，格式正確", () => {
    const candles = buildNoisyCandles();
    const signals = rangeReversalStrategy.generateSignals(candles, rangeReversalStrategy.defaultParams, ctx);
    expect(signals.length).toBeGreaterThan(0);
    assertWellFormedSignals(signals, new Set(candles.map((c) => c.openTime)));
  });

  it("無未來函數", () => {
    assertNoLookahead(rangeReversalStrategy, rangeReversalStrategy.defaultParams);
  });
});

describe("bollingerRsiReversionStrategy", () => {
  it("超賣門檻必須小於超買門檻", () => {
    const result = bollingerRsiReversionStrategy.validateParams({
      ...bollingerRsiReversionStrategy.defaultParams,
      oversold: 80,
      overbought: 20,
    });
    expect(result.valid).toBe(false);
  });

  it("可在含噪音資料上產生訊號，格式正確", () => {
    const candles = buildNoisyCandles();
    const signals = bollingerRsiReversionStrategy.generateSignals(candles, bollingerRsiReversionStrategy.defaultParams, ctx);
    expect(signals.length).toBeGreaterThan(0);
    assertWellFormedSignals(signals, new Set(candles.map((c) => c.openTime)));
  });

  it("無未來函數", () => {
    assertNoLookahead(bollingerRsiReversionStrategy, bollingerRsiReversionStrategy.defaultParams);
  });
});

describe("rsiDivergenceStructureStrategy", () => {
  it("擺動點確認根數必須介於合理範圍", () => {
    const result = rsiDivergenceStructureStrategy.validateParams({
      ...rsiDivergenceStructureStrategy.defaultParams,
      swingLookback: 1,
    });
    expect(result.valid).toBe(false);
  });

  it("可在含噪音資料上產生訊號，格式正確", () => {
    const candles = buildNoisyCandles(500);
    const signals = rsiDivergenceStructureStrategy.generateSignals(candles, rsiDivergenceStructureStrategy.defaultParams, ctx);
    expect(signals.length).toBeGreaterThan(0);
    assertWellFormedSignals(signals, new Set(candles.map((c) => c.openTime)));
  });

  it("無未來函數", () => {
    const candles = buildNoisyCandles(500);
    const fullSignals = rsiDivergenceStructureStrategy.generateSignals(candles, rsiDivergenceStructureStrategy.defaultParams, ctx);
    expect(fullSignals.length).toBeGreaterThan(0);
    const signalTime = fullSignals[Math.floor(fullSignals.length / 2)]!.time;
    const cutoffIndex = candles.findIndex((c) => c.openTime === signalTime);
    const truncated = candles.slice(0, cutoffIndex + 1);
    const truncatedSignals = rsiDivergenceStructureStrategy.generateSignals(
      truncated,
      rsiDivergenceStructureStrategy.defaultParams,
      ctx,
    );
    const fullSignalsWithinCutoff = fullSignals.filter((s) => s.time <= signalTime);
    expect(truncatedSignals).toEqual(fullSignalsWithinCutoff);
  });
});

describe("vwapPullbackStrategy", () => {
  it("偏向確認根數必須介於合理範圍", () => {
    const result = vwapPullbackStrategy.validateParams({ ...vwapPullbackStrategy.defaultParams, minBiasBars: 0 });
    expect(result.valid).toBe(false);
  });

  it("可在含噪音資料上產生訊號，格式正確", () => {
    const candles = buildNoisyCandles();
    const signals = vwapPullbackStrategy.generateSignals(candles, vwapPullbackStrategy.defaultParams, ctx);
    expect(signals.length).toBeGreaterThan(0);
    assertWellFormedSignals(signals, new Set(candles.map((c) => c.openTime)));
  });

  it("無未來函數", () => {
    assertNoLookahead(vwapPullbackStrategy, vwapPullbackStrategy.defaultParams);
  });
});

describe("falseBreakoutReclaimStrategy", () => {
  it("收回確認根數必須介於 1 至 50 之間", () => {
    const result = falseBreakoutReclaimStrategy.validateParams({ ...falseBreakoutReclaimStrategy.defaultParams, maxReclaimBars: 0 });
    expect(result.valid).toBe(false);
  });

  it("可在含噪音資料上產生訊號，格式正確", () => {
    const candles = buildNoisyCandles();
    const signals = falseBreakoutReclaimStrategy.generateSignals(candles, falseBreakoutReclaimStrategy.defaultParams, ctx);
    expect(signals.length).toBeGreaterThan(0);
    assertWellFormedSignals(signals, new Set(candles.map((c) => c.openTime)));
  });

  it("無未來函數", () => {
    assertNoLookahead(falseBreakoutReclaimStrategy, falseBreakoutReclaimStrategy.defaultParams);
  });
});
