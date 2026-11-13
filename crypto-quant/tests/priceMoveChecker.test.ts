import { describe, it, expect } from "vitest";
import { evaluatePriceMove } from "@/lib/alerts/priceMoveChecker";
import type { Candle } from "@/lib/market/types";

const BASE_TIME = 1_700_000_000_000;
const STEP_MS = 5 * 60 * 1000; // 5 分鐘

function candle(i: number, close: number, closed = true): Candle {
  return { openTime: BASE_TIME + i * STEP_MS, open: close, high: close + 1, low: close - 1, close, volume: 1000, closed };
}

describe("evaluatePriceMove（純函式）", () => {
  const baseRule = { thresholdPct: 5, windowMinutes: 30, direction: "both" as const, lastTriggeredAt: null };

  it("視窗內漲幅達到門檻時觸發，方向為 up", () => {
    // 30 分鐘視窗 = 6 根 5 分鐘 K 棒；idx0 收盤 100，idx6 收盤 106（+6%）
    const candles = Array.from({ length: 7 }, (_, i) => candle(i, i === 6 ? 106 : 100));
    const result = evaluatePriceMove(candles, baseRule, candles[6]!.openTime);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("up");
    expect(result!.changePct).toBeCloseTo(6, 5);
  });

  it("視窗內跌幅達到門檻時觸發，方向為 down", () => {
    const candles = Array.from({ length: 7 }, (_, i) => candle(i, i === 6 ? 94 : 100));
    const result = evaluatePriceMove(candles, baseRule, candles[6]!.openTime);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe("down");
    expect(result!.changePct).toBeCloseTo(-6, 5);
  });

  it("漲跌幅未達門檻時不觸發", () => {
    const candles = Array.from({ length: 7 }, (_, i) => candle(i, i === 6 ? 102 : 100));
    const result = evaluatePriceMove(candles, baseRule, candles[6]!.openTime);
    expect(result).toBeNull();
  });

  it("方向設定為僅急漲時，跌幅再大也不觸發", () => {
    const rule = { ...baseRule, direction: "up" as const };
    const candles = Array.from({ length: 7 }, (_, i) => candle(i, i === 6 ? 90 : 100));
    const result = evaluatePriceMove(candles, rule, candles[6]!.openTime);
    expect(result).toBeNull();
  });

  it("方向設定為僅急跌時，漲幅再大也不觸發", () => {
    const rule = { ...baseRule, direction: "down" as const };
    const candles = Array.from({ length: 7 }, (_, i) => candle(i, i === 6 ? 110 : 100));
    const result = evaluatePriceMove(candles, rule, candles[6]!.openTime);
    expect(result).toBeNull();
  });

  it("冷卻期內（距離上次觸發時間小於視窗長度）不重複觸發", () => {
    const candles = Array.from({ length: 7 }, (_, i) => candle(i, i === 6 ? 106 : 100));
    const lastTriggeredAt = candles[6]!.openTime - 10 * 60 * 1000; // 10 分鐘前觸發過，視窗是 30 分鐘
    const rule = { ...baseRule, lastTriggeredAt };
    const result = evaluatePriceMove(candles, rule, candles[6]!.openTime);
    expect(result).toBeNull();
  });

  it("冷卻期已過（距離上次觸發時間達到視窗長度）可再次觸發", () => {
    const candles = Array.from({ length: 7 }, (_, i) => candle(i, i === 6 ? 106 : 100));
    const lastTriggeredAt = candles[6]!.openTime - 30 * 60 * 1000;
    const rule = { ...baseRule, lastTriggeredAt };
    const result = evaluatePriceMove(candles, rule, candles[6]!.openTime);
    expect(result).not.toBeNull();
  });

  it("只採用已收盤的 K 棒，最新一根尚未收盤時忽略", () => {
    const candles = [
      ...Array.from({ length: 6 }, (_, i) => candle(i, 100)),
      candle(6, 106, false), // 尚未收盤
    ];
    const result = evaluatePriceMove(candles, baseRule, candles[6]!.openTime);
    // 已收盤的最新一根是 idx5（收盤 100），與基準 idx0（100）同價，不會觸發
    expect(result).toBeNull();
  });

  it("已收盤 K 棒數量不足 2 根時回傳 null", () => {
    const candles = [candle(0, 100)];
    const result = evaluatePriceMove(candles, baseRule, candles[0]!.openTime);
    expect(result).toBeNull();
  });
});
