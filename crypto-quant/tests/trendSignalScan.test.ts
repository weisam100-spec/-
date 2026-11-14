import { describe, it, expect } from "vitest";
import { buildTrendSignalCard } from "@/lib/signals/trendSignalScan";
import { fvgSupplyDemandStrategy, fvgSupplyDemandDefaultParams } from "@/lib/strategies/fvgSupplyDemand";
import { buildNoisyCandles } from "./fixtures/sampleCandles";

describe("buildTrendSignalCard（純函式）", () => {
  it("沒有任何 K 棒時回傳 null", () => {
    expect(buildTrendSignalCard([], "BTCUSDT", "5m", 144)).toBeNull();
  });

  it("有候選訊號時，卡片內容與策略直接產生的最新訊號一致", () => {
    // 這組固定種子、300 根的資料用策略預設參數會產生數筆候選訊號，可用來驗證卡片組裝邏輯
    const candles = buildNoisyCandles(300, 1);
    const expectedSignals = fvgSupplyDemandStrategy.generateSignals(candles, fvgSupplyDemandDefaultParams, {
      symbol: "BTCUSDT",
      interval: "5m",
    });
    expect(expectedSignals.length).toBeGreaterThan(0);
    const expectedLatest = expectedSignals[expectedSignals.length - 1]!;

    const card = buildTrendSignalCard(candles, "BTCUSDT", "5m", 144);
    expect(card).not.toBeNull();
    expect(card!.signal).not.toBeNull();
    expect(card!.signal!.time).toBe(expectedLatest.time);
    expect(card!.signal!.type).toBe(expectedLatest.type);
    expect(card!.signal!.price).toBe(expectedLatest.price);
    expect(card!.signal!.confidence).toBe(expectedLatest.confidence);

    const lastCandle = candles[candles.length - 1]!;
    expect(card!.currentPrice).toBe(lastCandle.close);
    expect(card!.changeSinceSignalPct).toBeCloseTo(
      ((lastCandle.close - expectedLatest.price) / expectedLatest.price) * 100,
      10,
    );
  });

  it("視窗長度內的最高／最低價與迷你走勢圖根數正確", () => {
    const candles = buildNoisyCandles(300, 1);
    const windowBars = 50;
    const card = buildTrendSignalCard(candles, "BTCUSDT", "5m", windowBars);
    const slice = candles.slice(-windowBars);
    expect(card!.sparkline.length).toBe(windowBars);
    expect(card!.windowHigh).toBeCloseTo(Math.max(...slice.map((c) => c.high)), 10);
    expect(card!.windowLow).toBeCloseTo(Math.min(...slice.map((c) => c.low)), 10);
  });

  it("視窗長度大於資料筆數時，採用全部資料而不會出錯", () => {
    const candles = buildNoisyCandles(10, 1);
    const card = buildTrendSignalCard(candles, "BTCUSDT", "5m", 500);
    expect(card!.sparkline.length).toBe(10);
  });

  it("沒有候選訊號時，狀態（相對訊號價格變動）為 null", () => {
    // 極短、幾乎沒有波動的資料，策略預設參數下不會形成任何候選訊號
    const flat = Array.from({ length: 5 }, (_, i) => ({
      openTime: 1_700_000_000_000 + i * 300_000,
      open: 100,
      high: 100.1,
      low: 99.9,
      close: 100,
      volume: 1000,
      closed: true,
    }));
    const card = buildTrendSignalCard(flat, "BTCUSDT", "5m", 144);
    expect(card!.signal).toBeNull();
    expect(card!.changeSinceSignalPct).toBeNull();
  });
});
