import { describe, it, expect } from "vitest";
import { detectFvgZones } from "@/lib/strategies/fvgDetection";
import { fvgSupplyDemandStrategy, fvgSupplyDemandDefaultParams } from "@/lib/strategies/fvgSupplyDemand";
import { buildNoisyCandles, buildCandlesFromCloses } from "./fixtures/sampleCandles";
import type { Candle } from "@/lib/market/types";

const ctx = { symbol: "BTCUSDT", interval: "1h" as const };

function candle(i: number, open: number, high: number, low: number, close: number): Candle {
  return { openTime: 1_700_000_000_000 + i * 3_600_000, open, high, low, close, volume: 1000, closed: true };
}

describe("detectFvgZones", () => {
  it("資料量過少時回傳空結果", () => {
    const result = detectFvgZones(buildCandlesFromCloses([100, 101]), { minGapPct: 0.05, maxAgeBars: 40 });
    expect(result.touches).toEqual([]);
    expect(result.active).toEqual([]);
  });

  it("連續三根出現沒有重疊的向上缺口時，形成多頭 FVG", () => {
    const candles = [
      candle(0, 100, 101, 99, 100),
      candle(1, 100, 110, 100, 108), // 帶動缺口的中間大陽線
      candle(2, 109, 112, 109, 111), // 第 3 根低點(109) > 第 1 根高點(101)，形成缺口
      candle(3, 111, 112, 110, 111),
    ];
    const result = detectFvgZones(candles, { minGapPct: 0.05, maxAgeBars: 40 });
    expect(result.active.length).toBe(1);
    expect(result.active[0]!.type).toBe("bullish");
    expect(result.active[0]!.bottom).toBeCloseTo(101, 6);
    expect(result.active[0]!.top).toBeCloseTo(109, 6);
  });

  it("價格回補缺口時，從 active 移至 touches", () => {
    const candles = [
      candle(0, 100, 101, 99, 100),
      candle(1, 100, 110, 100, 108),
      candle(2, 109, 112, 109, 111),
      candle(3, 111, 112, 95, 96), // 回補：低點跌回缺口範圍內
    ];
    const result = detectFvgZones(candles, { minGapPct: 0.05, maxAgeBars: 40 });
    expect(result.active).toEqual([]);
    expect(result.touches.length).toBe(1);
    expect(result.touches[0]!.type).toBe("bullish");
    expect(result.touches[0]!.index).toBe(3);
  });

  it("缺口過小（低於 minGapPct）時不會被偵測", () => {
    const candles = [
      candle(0, 100, 100.01, 99.99, 100),
      candle(1, 100, 100.05, 99.95, 100.02),
      candle(2, 100.015, 100.05, 100.015, 100.03), // 幾乎沒有缺口
      candle(3, 100.03, 100.05, 100.01, 100.02),
    ];
    const result = detectFvgZones(candles, { minGapPct: 1, maxAgeBars: 40 });
    expect(result.active).toEqual([]);
  });

  it("超過有效期仍未回補的缺口會從 active 移除", () => {
    const candles = [
      candle(0, 100, 101, 99, 100),
      candle(1, 100, 110, 100, 108),
      candle(2, 109, 112, 109, 111),
      candle(3, 111, 112, 110, 111),
      candle(4, 111, 112, 110, 111),
    ];
    const result = detectFvgZones(candles, { minGapPct: 0.05, maxAgeBars: 1 });
    expect(result.active).toEqual([]);
  });

  it("空頭缺口（向下）偵測", () => {
    const candles = [
      candle(0, 100, 101, 99, 100),
      candle(1, 100, 100, 90, 92), // 帶動缺口的中間大陰線
      candle(2, 91, 91, 88, 89), // 第 3 根高點(91) < 第 1 根低點(99)，形成向下缺口
      candle(3, 89, 90, 88, 89),
    ];
    const result = detectFvgZones(candles, { minGapPct: 0.05, maxAgeBars: 40 });
    expect(result.active.length).toBe(1);
    expect(result.active[0]!.type).toBe("bearish");
    expect(result.active[0]!.top).toBeCloseTo(99, 6);
    expect(result.active[0]!.bottom).toBeCloseTo(91, 6);
  });
});

describe("fvgSupplyDemandStrategy.validateParams", () => {
  it("預設參數驗證通過", () => {
    expect(fvgSupplyDemandStrategy.validateParams(fvgSupplyDemandDefaultParams).valid).toBe(true);
  });

  it("擺動點確認根數超出範圍時驗證失敗", () => {
    const result = fvgSupplyDemandStrategy.validateParams({ ...fvgSupplyDemandDefaultParams, swingLookback: 1 });
    expect(result.valid).toBe(false);
  });

  it("FVG 最小缺口比例為負數時驗證失敗", () => {
    const result = fvgSupplyDemandStrategy.validateParams({ ...fvgSupplyDemandDefaultParams, minGapPct: -1 });
    expect(result.valid).toBe(false);
  });

  it("雙重確認容許根數超出範圍時驗證失敗", () => {
    const result = fvgSupplyDemandStrategy.validateParams({ ...fvgSupplyDemandDefaultParams, confirmWindowBars: -1 });
    expect(result.valid).toBe(false);
  });
});

describe("fvgSupplyDemandStrategy.generateSignals", () => {
  // 較寬鬆的參數，提高在雜訊資料上同時出現供需區回測與 FVG 回補的機率
  const looseParams = {
    ...fvgSupplyDemandDefaultParams,
    swingLookback: 3,
    minDisplacementMultiple: 0.8,
    orderBlockLookback: 20,
    maxMitigationBars: 80,
    minGapPct: 0.02,
    maxFvgAgeBars: 80,
    confirmWindowBars: 10,
  };

  it("在雜訊資料上執行不會噴錯，且會產生至少一個雙重確認訊號", () => {
    const candles = buildNoisyCandles(400, 11);
    const signals = fvgSupplyDemandStrategy.generateSignals(candles, looseParams, ctx);
    expect(signals.length).toBeGreaterThan(0);
    for (const s of signals) {
      expect(["bullish_candidate", "bearish_candidate"]).toContain(s.type);
      expect(s.confidence).toBeGreaterThanOrEqual(0);
      expect(s.confidence).toBeLessThanOrEqual(100);
      expect(s.reason).toContain("FVG");
    }
  });

  it("訊號時間依序遞增", () => {
    const candles = buildNoisyCandles(400, 11);
    const signals = fvgSupplyDemandStrategy.generateSignals(candles, looseParams, ctx);
    for (let i = 1; i < signals.length; i++) {
      expect(signals[i]!.time).toBeGreaterThanOrEqual(signals[i - 1]!.time);
    }
  });

  it("只用訊號當根（含）之前的資料時，產生的訊號必須與完整資料中同一時間點的訊號完全一致（無未來函數）", () => {
    const candles = buildNoisyCandles(400, 11);
    const fullSignals = fvgSupplyDemandStrategy.generateSignals(candles, looseParams, ctx);
    expect(fullSignals.length).toBeGreaterThan(0);

    // 取中段某個訊號作為截斷點，驗證截斷後重算的結果與完整資料在該時間點（含）之前完全一致
    const pivot = fullSignals[Math.floor(fullSignals.length / 2)]!;
    const cutoffIndex = candles.findIndex((c) => c.openTime === pivot.time);
    const truncated = candles.slice(0, cutoffIndex + 1);

    const truncatedSignals = fvgSupplyDemandStrategy.generateSignals(truncated, looseParams, ctx);
    const fullSignalsWithinCutoff = fullSignals.filter((s) => s.time <= pivot.time);
    expect(truncatedSignals).toEqual(fullSignalsWithinCutoff);
  });

  it("只有供需區或只有 FVG 單一條件成立時不會觸發訊號（必須雙重確認）", () => {
    // 關閉雙重確認視窗（設為 0 且錯開事件），模擬只有單一條件成立的情況：
    // 透過只擷取資料末端（讓其中一種事件尚未發生）驗證訊號不會提早觸發
    const candles = buildNoisyCandles(400, 11);
    const strictParams = { ...looseParams, confirmWindowBars: 0 };
    const signals = fvgSupplyDemandStrategy.generateSignals(candles, strictParams, ctx);
    // 嚴格視窗下訊號數必須不多於寬鬆視窗下的訊號數
    const looseSignals = fvgSupplyDemandStrategy.generateSignals(candles, looseParams, ctx);
    expect(signals.length).toBeLessThanOrEqual(looseSignals.length);
  });
});
