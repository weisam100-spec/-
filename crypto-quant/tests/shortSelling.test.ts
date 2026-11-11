import { describe, it, expect } from "vitest";
import { runBacktest } from "@/lib/backtest/engine";
import { defaultBacktestConfig } from "@/lib/backtest/types";
import type { Candle } from "@/lib/market/types";
import type { StrategySignal } from "@/lib/strategies/types";

const BASE_TIME = 1_700_000_000_000;
const STEP_MS = 3_600_000;

function candle(i: number, open: number, high: number, low: number, close: number): Candle {
  return { openTime: BASE_TIME + i * STEP_MS, open, high, low, close, volume: 1000, closed: true };
}

function bullishSignalAt(c: Candle): StrategySignal {
  return { time: c.openTime, symbol: "BTCUSDT", interval: "1h", type: "bullish_candidate", price: c.close, reason: "test", confidence: 80, params: {} };
}
function bearishSignalAt(c: Candle): StrategySignal {
  return { time: c.openTime, symbol: "BTCUSDT", interval: "1h", type: "bearish_candidate", price: c.close, reason: "test", confidence: 80, params: {} };
}

function fullRangeConfig(candles: Candle[], overrides: Partial<typeof defaultBacktestConfig> = {}) {
  return {
    ...defaultBacktestConfig,
    startTime: candles[0]!.openTime,
    endTime: candles[candles.length - 1]!.openTime,
    ...overrides,
  };
}

describe("runBacktest - 模擬做空（long_short 模式）", () => {
  it("direction=long_only（預設）時，偏空候選訊號不會開空單", () => {
    const candles = [
      candle(0, 100, 100.1, 99.9, 100),
      candle(1, 100, 100.1, 99.9, 100), // 偏空訊號
      candle(2, 100, 100.2, 95, 96), // 大跌，若有開空單這裡會獲利
    ];
    const signals = [bearishSignalAt(candles[1]!)];
    const result = runBacktest({ candles, signals, config: fullRangeConfig(candles, { direction: "long_only" }) });
    expect(result.trades.length).toBe(0);
  });

  it("direction=long_short 時，偏空候選訊號會開空單，價格下跌時獲利", () => {
    const candles = [
      candle(0, 100, 100.1, 99.9, 100),
      candle(1, 100, 100.1, 99.9, 100), // 偏空訊號
      candle(2, 100, 100.2, 95, 96), // 進場根（開盤 100 放空），之後下跌
      candle(3, 96, 96.5, 85, 88), // 持續下跌
    ];
    const signals = [bearishSignalAt(candles[1]!)];
    const config = fullRangeConfig(candles, { feeRatePct: 0, slippageRatePct: 0, direction: "long_short" });
    const result = runBacktest({ candles, signals, config });

    expect(result.trades.length).toBe(1);
    const trade = result.trades[0]!;
    expect(trade.side).toBe("short");
    expect(trade.entryPrice).toBeCloseTo(100, 6);
    // 空單在期末以最後收盤價 88 結算，進場價 100，應該獲利
    expect(trade.exitPrice).toBeCloseTo(88, 6);
    expect(trade.pnl).toBeGreaterThan(0);
  });

  it("空單價格上漲時虧損", () => {
    const candles = [
      candle(0, 100, 100.1, 99.9, 100),
      candle(1, 100, 100.1, 99.9, 100),
      candle(2, 100, 100.2, 99.8, 100),
      candle(3, 100, 110, 99, 108), // 上漲
    ];
    const signals = [bearishSignalAt(candles[1]!)];
    const config = fullRangeConfig(candles, { feeRatePct: 0, slippageRatePct: 0, direction: "long_short" });
    const result = runBacktest({ candles, signals, config });
    expect(result.trades.length).toBe(1);
    expect(result.trades[0]!.pnl).toBeLessThan(0);
  });

  it("空單的停損在進場價「上方」，價格上漲觸發停損出場", () => {
    const candles = [
      candle(0, 100, 100.1, 99.9, 100),
      candle(1, 100, 100.1, 99.9, 100),
      candle(2, 100, 100.2, 99.8, 100), // 進場（100）
      candle(3, 100, 106, 99, 104), // 漲破停損（entry*1.05=105）
    ];
    const signals = [bearishSignalAt(candles[1]!)];
    const config = fullRangeConfig(candles, { feeRatePct: 0, slippageRatePct: 0, direction: "long_short", stopLossPct: 5 });
    const result = runBacktest({ candles, signals, config });
    expect(result.trades.length).toBe(1);
    expect(result.trades[0]!.exitReason).toContain("停損");
    expect(result.trades[0]!.exitPrice).toBeCloseTo(105, 6);
    expect(result.trades[0]!.pnl).toBeLessThan(0);
  });

  it("空單的停利在進場價「下方」，價格下跌觸發停利出場", () => {
    const candles = [
      candle(0, 100, 100.1, 99.9, 100),
      candle(1, 100, 100.1, 99.9, 100),
      candle(2, 100, 100.2, 99.8, 100), // 進場（100）
      candle(3, 100, 100.5, 94, 95), // 跌破停利（entry*0.95=95）
    ];
    const signals = [bearishSignalAt(candles[1]!)];
    const config = fullRangeConfig(candles, { feeRatePct: 0, slippageRatePct: 0, direction: "long_short", takeProfitPct: 5 });
    const result = runBacktest({ candles, signals, config });
    expect(result.trades.length).toBe(1);
    expect(result.trades[0]!.exitReason).toContain("停利");
    expect(result.trades[0]!.exitPrice).toBeCloseTo(95, 6);
    expect(result.trades[0]!.pnl).toBeGreaterThan(0);
  });

  it("偏多候選訊號會平掉既有的空單（反方向出場）", () => {
    const candles = [
      candle(0, 100, 100.1, 99.9, 100),
      candle(1, 100, 100.1, 99.9, 100), // 偏空訊號
      candle(2, 100, 100.2, 99.8, 100), // 進場
      candle(3, 100, 100.2, 98, 99), // 偏多訊號（平倉訊號）
      candle(4, 99, 99.2, 98.8, 99), // 下一根開盤出場
    ];
    const signals = [bearishSignalAt(candles[1]!), bullishSignalAt(candles[3]!)];
    const config = fullRangeConfig(candles, { feeRatePct: 0, slippageRatePct: 0, direction: "long_short" });
    const result = runBacktest({ candles, signals, config });
    expect(result.trades.length).toBe(1);
    expect(result.trades[0]!.exitReason).toContain("反方向候選訊號");
    expect(result.trades[0]!.exitTime).toBe(candles[4]!.openTime);
  });

  it("空單搭配分批停利（TP1/TP2），方向正確鏡像", () => {
    const candles = [
      candle(0, 100, 100.1, 99.9, 100),
      candle(1, 100, 100.1, 99.9, 100),
      candle(2, 100, 100.2, 99.8, 100), // 進場（100）
      candle(3, 100, 100.5, 96, 97), // 觸及 TP1（entry*0.97=97）
      candle(4, 97, 97.5, 92, 93), // 觸及 TP2（entry*0.92=92）
    ];
    const signals = [bearishSignalAt(candles[1]!)];
    const config = fullRangeConfig(candles, {
      feeRatePct: 0,
      slippageRatePct: 0,
      direction: "long_short",
      splitTakeProfit: { tp1Pct: 3, tp1SizePct: 50, tp2Pct: 8 },
    });
    const result = runBacktest({ candles, signals, config });
    expect(result.trades.length).toBe(2);
    expect(result.trades[0]!.tpStage).toBe("tp1");
    expect(result.trades[0]!.pnl).toBeGreaterThan(0);
    expect(result.trades[1]!.tpStage).toBe("tp2");
    expect(result.trades[1]!.pnl).toBeGreaterThan(0);
  });

  it("空單搭配固定風險比例部位（1R），虧損金額約等於設定的風險比例", () => {
    const candles = [
      candle(0, 100, 100.1, 99.9, 100),
      candle(1, 100, 100.1, 99.9, 100),
      candle(2, 100, 100.2, 99.8, 100), // 進場（100）
      candle(3, 100, 106, 99, 104), // 漲破停損（entry*1.05=105）
    ];
    const signals = [bearishSignalAt(candles[1]!)];
    const config = fullRangeConfig(candles, {
      feeRatePct: 0,
      slippageRatePct: 0,
      direction: "long_short",
      stopLossPct: 5,
      riskBasedSizing: { riskPct: 1 },
    });
    const result = runBacktest({ candles, signals, config });
    expect(result.trades.length).toBe(1);
    // 可用資金 100,000 的 1% = 1,000
    expect(Math.abs(result.trades[0]!.pnl + 1000)).toBeLessThan(5);
  });

  it("資金守恆：空單一次完整進出場後，現金變化量等於損益（不會無中生有或遺失資金）", () => {
    const candles = [
      candle(0, 100, 100.1, 99.9, 100),
      candle(1, 100, 100.1, 99.9, 100),
      candle(2, 100, 100.2, 99.8, 100),
      candle(3, 100, 101, 90, 92),
    ];
    const signals = [bearishSignalAt(candles[1]!)];
    const config = fullRangeConfig(candles, { feeRatePct: 0.1, slippageRatePct: 0.05, direction: "long_short" });
    const result = runBacktest({ candles, signals, config });
    expect(result.trades.length).toBe(1);
    const trade = result.trades[0]!;
    const finalEquity = result.equityCurve[result.equityCurve.length - 1]!.equity;
    expect(finalEquity).toBeCloseTo(config.initialCapitalUsdt + trade.pnl, 4);
  });
});
