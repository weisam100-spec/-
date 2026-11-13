import { describe, it, expect } from "vitest";
import { computeStructureTrend, structureAsOf, HIGHER_TIMEFRAME } from "@/lib/strategies/higherTimeframe";
import { fvgSupplyDemandStrategy, fvgSupplyDemandDefaultParams } from "@/lib/strategies/fvgSupplyDemand";
import { buildNoisyCandles } from "./fixtures/sampleCandles";
import { INTERVAL_MS } from "@/lib/market/symbols";
import type { Candle } from "@/lib/market/types";

const ctx = { symbol: "BTCUSDT", interval: "1h" as const };

function candle(i: number, open: number, high: number, low: number, close: number, stepMs = 3_600_000): Candle {
  return { openTime: 1_700_000_000_000 + i * stepMs, open, high, low, close, volume: 1000, closed: true };
}

/**
 * 訊號中會原樣內嵌呼叫時的 params 快照；當兩次呼叫只是 useHigherTimeframeFilter
 * 開關不同、但預期過濾「沒有產生實際效果」時，比較結果需忽略這個開關欄位本身的差異，
 * 否則光是開關值不同就會讓 toEqual 誤判為不相等。
 */
function withoutFilterFlag<T extends { params: Record<string, unknown> }>(signals: T[]) {
  return signals.map((s) => ({ ...s, params: { ...s.params, useHigherTimeframeFilter: false } }));
}

describe("HIGHER_TIMEFRAME 對照表", () => {
  it("日線沒有更高週期可用", () => {
    expect(HIGHER_TIMEFRAME["1d"]).toBeNull();
  });
  it("其餘週期都有對應的更高週期", () => {
    expect(HIGHER_TIMEFRAME["5m"]).toBe("1h");
    expect(HIGHER_TIMEFRAME["15m"]).toBe("4h");
    expect(HIGHER_TIMEFRAME["1h"]).toBe("4h");
    expect(HIGHER_TIMEFRAME["4h"]).toBe("1d");
  });
});

describe("computeStructureTrend", () => {
  it("收盤價突破前波高點後，結構轉為多頭", () => {
    // swingLookback=2 時，擺動點（pivotIndex=2）需左右各 2 根 K 棒才能確認（confirmedAt=4）
    const candles = [
      candle(0, 100, 101, 99, 100),
      candle(1, 101, 102, 100, 101),
      candle(2, 102, 103, 101, 102), // 波段高點 103（pivotIndex=2）
      candle(3, 100, 101, 98, 99),
      candle(4, 98, 99, 96, 97), // 擺動高點於此根確認（confirmedAt=2+2=4）
      candle(5, 97, 98, 95, 96),
      candle(6, 100, 110, 99, 108), // 收盤 108 突破前波高點 103，轉為多頭
    ];
    const trend = computeStructureTrend(candles, 2);
    expect(trend[trend.length - 1]!.structure).toBe("bullish");
  });

  it("收盤價跌破前波低點後，結構轉為空頭", () => {
    const candles = [
      candle(0, 100, 101, 99, 100),
      candle(1, 99, 100, 98, 99),
      candle(2, 98, 99, 97, 98), // 波段低點 97（pivotIndex=2）
      candle(3, 100, 101, 99, 100),
      candle(4, 102, 103, 101, 102), // 擺動低點於此根確認（confirmedAt=2+2=4）
      candle(5, 103, 104, 102, 103),
      candle(6, 100, 101, 90, 92), // 收盤 92 跌破前波低點 97，轉為空頭
    ];
    const trend = computeStructureTrend(candles, 2);
    expect(trend[trend.length - 1]!.structure).toBe("bearish");
  });

  it("無未來函數：截斷資料後，相同時間點之前的結構判斷完全一致", () => {
    const candles = buildNoisyCandles(200, 5);
    const full = computeStructureTrend(candles, 3);
    const cutoff = 150;
    const truncated = computeStructureTrend(candles.slice(0, cutoff), 3);
    for (let i = 0; i < cutoff; i++) {
      expect(truncated[i]).toEqual(full[i]);
    }
  });
});

describe("structureAsOf", () => {
  const snapshots = [
    { openTime: 1000, structure: "unknown" as const },
    { openTime: 2000, structure: "bullish" as const },
    { openTime: 3000, structure: "bearish" as const },
  ];
  const higherIntervalMs = 1000;

  it("只採用在 asOfTime 之前已經收盤的高週期 K 棒", () => {
    // openTime=2000 的 K 棒要到 3000 才收盤，asOfTime=2500 時它尚未收盤，應採用更早的 unknown
    expect(structureAsOf(snapshots, 2500, higherIntervalMs)).toBe("unknown");
    // asOfTime=3000 時 openTime=2000 的 K 棒已收盤（2000+1000=3000<=3000）
    expect(structureAsOf(snapshots, 3000, higherIntervalMs)).toBe("bullish");
    // asOfTime=4000 時 openTime=3000 的 K 棒也已收盤
    expect(structureAsOf(snapshots, 4000, higherIntervalMs)).toBe("bearish");
  });

  it("asOfTime 早於所有快照時回傳 unknown", () => {
    expect(structureAsOf(snapshots, 500, higherIntervalMs)).toBe("unknown");
  });
});

describe("fvgSupplyDemandStrategy - 多時間框架順勢過濾", () => {
  const candles = buildNoisyCandles(400, 11);
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

  it("預設關閉時，不受 ctx.higherTimeframeCandles 影響", () => {
    const baseline = fvgSupplyDemandStrategy.generateSignals(candles, looseParams, ctx);
    const withHigherTf = fvgSupplyDemandStrategy.generateSignals(candles, looseParams, {
      ...ctx,
      higherTimeframeCandles: [],
    });
    expect(withHigherTf).toEqual(baseline);
  });

  it("啟用時，若高週期持續多頭，所有偏空候選訊號都會被濾掉", () => {
    const enabledParams = { ...looseParams, useHigherTimeframeFilter: true };
    const baseline = fvgSupplyDemandStrategy.generateSignals(candles, looseParams, ctx);
    expect(baseline.some((s) => s.type === "bearish_candidate")).toBe(true);

    // 建立一段持續上漲、結構一路偏多的高週期（4h）資料，涵蓋整個主要週期回測區間
    const higherCandles: Candle[] = [];
    let price = 50;
    for (let i = 0; i < 300; i++) {
      const open = price;
      const close = price + 1;
      higherCandles.push(candle(i, open, close + 0.5, open - 0.5, close, INTERVAL_MS["4h"]));
      price = close;
    }
    const filtered = fvgSupplyDemandStrategy.generateSignals(candles, enabledParams, {
      ...ctx,
      higherTimeframeCandles: higherCandles,
    });
    expect(filtered.every((s) => s.type !== "bearish_candidate")).toBe(true);
    expect(filtered.length).toBeLessThanOrEqual(baseline.length);
  });

  it("啟用但呼叫端沒有提供高週期資料時，原樣放行（不會因此永遠零訊號）", () => {
    const enabledParams = { ...looseParams, useHigherTimeframeFilter: true };
    const baseline = fvgSupplyDemandStrategy.generateSignals(candles, looseParams, ctx);
    const noHigherTf = fvgSupplyDemandStrategy.generateSignals(candles, enabledParams, ctx);
    expect(withoutFilterFlag(noHigherTf)).toEqual(withoutFilterFlag(baseline));
  });

  it("日線（無更高週期）時，開關不會有效果", () => {
    const dailyCtx = { symbol: "BTCUSDT", interval: "1d" as const };
    const enabledParams = { ...looseParams, useHigherTimeframeFilter: true };
    const baseline = fvgSupplyDemandStrategy.generateSignals(candles, looseParams, dailyCtx);
    const withFilter = fvgSupplyDemandStrategy.generateSignals(candles, enabledParams, {
      ...dailyCtx,
      higherTimeframeCandles: candles,
    });
    expect(withoutFilterFlag(withFilter)).toEqual(withoutFilterFlag(baseline));
  });

  it("無未來函數：啟用順勢過濾後，截斷資料產生的訊號仍與完整資料在同一時間點之前完全一致", () => {
    const enabledParams = { ...looseParams, useHigherTimeframeFilter: true };
    // 建立「上漲→回檔→再突破前波高點」的高週期資料：先漲 10 根形成波段高點，回檔 6 根使其
    // 真正成為局部高點並獲得確認，接著再漲 4 根收盤突破前波高點（結構轉為多頭），
    // 之後持續緩漲維持多頭結構，確保涵蓋整個主要週期回測區間時結構已脫離 unknown。
    const higherCandles: Candle[] = [];
    let price = 50;
    for (let i = 0; i < 300; i++) {
      const open = price;
      let close: number;
      if (i < 10) close = price + 2;
      else if (i < 16) close = price - 1;
      else if (i < 20) close = price + 2;
      else close = price + 1;
      higherCandles.push(candle(i, open, Math.max(open, close) + 0.5, Math.min(open, close) - 0.5, close, INTERVAL_MS["4h"]));
      price = close;
    }
    const fullSignals = fvgSupplyDemandStrategy.generateSignals(candles, enabledParams, {
      ...ctx,
      higherTimeframeCandles: higherCandles,
    });
    expect(fullSignals.length).toBeGreaterThan(0);

    const pivot = fullSignals[Math.floor(fullSignals.length / 2)]!;
    const cutoffIndex = candles.findIndex((c) => c.openTime === pivot.time);
    const truncatedCandles = candles.slice(0, cutoffIndex + 1);
    const truncatedHigherCandles = higherCandles.filter((c) => c.openTime <= pivot.time);

    const truncatedSignals = fvgSupplyDemandStrategy.generateSignals(truncatedCandles, enabledParams, {
      ...ctx,
      higherTimeframeCandles: truncatedHigherCandles,
    });
    const fullSignalsWithinCutoff = fullSignals.filter((s) => s.time <= pivot.time);
    expect(truncatedSignals).toEqual(fullSignalsWithinCutoff);
  });
});
