import { describe, it, expect } from "vitest";
import { ema, sma, rsi, macd, bollinger, rollingVolatility, volumeRatio } from "@/lib/indicators";
import { buildSampleCloses, buildSampleCandles } from "./fixtures/sampleCandles";

describe("ema", () => {
  const closes = buildSampleCloses();

  it("暖機期回傳 NaN，長度與輸入一致", () => {
    const result = ema(closes, 20);
    expect(result).toHaveLength(closes.length);
    for (let i = 0; i < 19; i++) expect(Number.isNaN(result[i])).toBe(true);
    expect(Number.isNaN(result[19])).toBe(false);
  });

  it("短週期 EMA 對價格變化的反應快於長週期 EMA", () => {
    const shortEma = ema(closes, 5);
    const longEma = ema(closes, 20);
    // 上升段末端，短均線應已追上並高於長均線
    const idx = 58;
    expect(shortEma[idx]!).toBeGreaterThan(longEma[idx]!);
  });

  it("固定簡單序列的 EMA 數值正確（種子為前 period 筆均值）", () => {
    const values = [1, 2, 3, 4, 5, 6];
    const result = ema(values, 3);
    expect(result[0]).toBeNaN();
    expect(result[1]).toBeNaN();
    expect(result[2]).toBeCloseTo(2, 6); // (1+2+3)/3
    const k = 2 / 4;
    expect(result[3]).toBeCloseTo(4 * k + 2 * (1 - k), 6);
  });
});

describe("sma", () => {
  it("計算正確且暖機期為 NaN", () => {
    const values = [1, 2, 3, 4, 5];
    const result = sma(values, 3);
    expect(result[0]).toBeNaN();
    expect(result[1]).toBeNaN();
    expect(result[2]).toBeCloseTo(2, 6);
    expect(result[3]).toBeCloseTo(3, 6);
    expect(result[4]).toBeCloseTo(4, 6);
  });
});

describe("rsi", () => {
  it("持續上漲時 RSI 應趨近 100", () => {
    const upOnly = Array.from({ length: 30 }, (_, i) => 100 + i);
    const result = rsi(upOnly, 14);
    expect(result[29]!).toBeGreaterThan(95);
  });

  it("持續下跌時 RSI 應趨近 0", () => {
    const downOnly = Array.from({ length: 30 }, (_, i) => 100 - i);
    const result = rsi(downOnly, 14);
    expect(result[29]!).toBeLessThan(5);
  });

  it("數值範圍必須落在 0~100 之間", () => {
    const closes = buildSampleCloses();
    const result = rsi(closes, 14);
    for (const v of result) {
      if (!Number.isNaN(v)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe("macd", () => {
  it("回傳長度一致且暖機期為 NaN", () => {
    const closes = buildSampleCloses();
    const { macd: macdLine, signal, histogram } = macd(closes, 12, 26, 9);
    expect(macdLine).toHaveLength(closes.length);
    expect(signal).toHaveLength(closes.length);
    expect(histogram).toHaveLength(closes.length);
    expect(Number.isNaN(macdLine[24])).toBe(true);
    expect(Number.isNaN(macdLine[25])).toBe(false);
  });

  it("快線週期須小於慢線週期，否則拋出錯誤", () => {
    expect(() => macd([1, 2, 3], 26, 12, 9)).toThrow();
  });
});

describe("bollinger", () => {
  it("上軌永遠不低於中軌，下軌永遠不高於中軌", () => {
    const closes = buildSampleCloses();
    const { middle, upper, lower } = bollinger(closes, 20, 2);
    for (let i = 20; i < closes.length; i++) {
      expect(upper[i]!).toBeGreaterThanOrEqual(middle[i]!);
      expect(lower[i]!).toBeLessThanOrEqual(middle[i]!);
    }
  });
});

describe("rollingVolatility", () => {
  it("平穩序列的波動度應接近 0", () => {
    const flat = Array.from({ length: 30 }, () => 100);
    const result = rollingVolatility(flat, 10);
    expect(result[29]!).toBeCloseTo(0, 6);
  });
});

describe("volumeRatio", () => {
  it("量能放大時比值大於 1", () => {
    const candles = buildSampleCandles();
    const volumes = candles.map((c) => c.volume);
    const spiked = [...volumes];
    spiked[spiked.length - 1] = Math.max(...volumes) * 5;
    const result = volumeRatio(spiked, 20);
    expect(result[result.length - 1]!).toBeGreaterThan(1);
  });
});
