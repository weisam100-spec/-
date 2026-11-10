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
  return {
    time: c.openTime,
    symbol: "BTCUSDT",
    interval: "1h",
    type: "bullish_candidate",
    price: c.close,
    reason: "test",
    confidence: 80,
    params: {},
  };
}

function fullRangeConfig(candles: Candle[], overrides: Partial<typeof defaultBacktestConfig> = {}) {
  return {
    ...defaultBacktestConfig,
    startTime: candles[0]!.openTime,
    endTime: candles[candles.length - 1]!.openTime,
    ...overrides,
  };
}

describe("runBacktest - 固定風險比例部位（1R）", () => {
  it("依停損距離反推部位大小，命中停損時的虧損金額約等於設定的風險比例", () => {
    const candles: Candle[] = [
      candle(0, 100, 100.1, 99.9, 100),
      candle(1, 100, 100.1, 99.9, 100), // 訊號在此根
      candle(2, 100, 100.5, 99.5, 100.2), // 進場根（開盤 100 進場）
      candle(3, 100.2, 100.3, 94, 95), // 跌破停損（entry*0.95=95）
    ];
    const signals = [bullishSignalAt(candles[1]!)];
    const config = fullRangeConfig(candles, {
      feeRatePct: 0,
      slippageRatePct: 0,
      stopLossPct: 5,
      riskBasedSizing: { riskPct: 1 }, // 願意賠掉可用資金的 1%
    });
    const result = runBacktest({ candles, signals, config });

    expect(result.trades.length).toBe(1);
    const trade = result.trades[0]!;
    expect(trade.exitReason).toContain("停損");
    // 可用資金 100,000 的 1% = 1,000，無手續費／滑價時虧損應非常接近 1,000
    expect(Math.abs(trade.pnl + 1000)).toBeLessThan(5);
  });

  it("反推出的部位金額超過可用資金時，會被限制在可用資金以內（不開槓桿）", () => {
    const candles: Candle[] = [
      candle(0, 100, 100.1, 99.9, 100),
      candle(1, 100, 100.1, 99.9, 100),
      candle(2, 100, 100.5, 99.5, 100.2),
      candle(3, 100.2, 110, 100, 108),
    ];
    const signals = [bullishSignalAt(candles[1]!)];
    // riskPct=50、stopLossPct=1 理論上要用到 50 倍資金才能達到目標風險，現貨應該被限制在可用資金以內
    const config = fullRangeConfig(candles, {
      feeRatePct: 0,
      slippageRatePct: 0,
      stopLossPct: 1,
      riskBasedSizing: { riskPct: 50 },
      positionSizePct: 100,
    });
    const result = runBacktest({ candles, signals, config });
    expect(result.trades.length).toBe(1);
    const trade = result.trades[0]!;
    // 投入成本不應超過初始資金
    expect(trade.quantity * trade.entryPrice).toBeLessThanOrEqual(config.initialCapitalUsdt + 1e-6);
  });

  it("未設定 riskBasedSizing 時，行為與舊版（positionSizePct）完全相同", () => {
    const candles: Candle[] = [
      candle(0, 100, 100.1, 99.9, 100),
      candle(1, 100, 100.1, 99.9, 100),
      candle(2, 100, 100.5, 99.5, 100.2),
      candle(3, 100.2, 106, 100, 105),
    ];
    const signals = [bullishSignalAt(candles[1]!)];
    const config = fullRangeConfig(candles, { positionSizePct: 40, riskBasedSizing: null });
    const result = runBacktest({ candles, signals, config });
    expect(result.trades.length).toBe(1);
    const investAmount = result.trades[0]!.quantity * result.trades[0]!.entryPrice + result.trades[0]!.entryFee;
    expect(investAmount).toBeCloseTo(config.initialCapitalUsdt * 0.4, 1);
  });
});

describe("validateBacktestConfig - 固定風險比例部位（1R）參數驗證", () => {
  const candles: Candle[] = [
    candle(0, 100, 100.1, 99.9, 100),
    candle(1, 100, 100.1, 99.9, 100),
    candle(2, 100, 100.5, 99.5, 100.2),
  ];

  it("啟用時必須設定停損比例，否則拋出錯誤", () => {
    const config = fullRangeConfig(candles, {
      riskBasedSizing: { riskPct: 1 },
      stopLossPct: null,
    });
    expect(() => runBacktest({ candles, signals: [], config })).toThrow(/停損/);
  });

  it("風險比例必須介於 0（不含）至 100 之間", () => {
    const config = fullRangeConfig(candles, {
      riskBasedSizing: { riskPct: 0 },
      stopLossPct: 5,
    });
    expect(() => runBacktest({ candles, signals: [], config })).toThrow(/風險比例/);
  });
});
