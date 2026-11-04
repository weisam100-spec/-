import { describe, it, expect } from "vitest";
import { runBacktest } from "@/lib/backtest/engine";
import { computeMetrics, groupTradesIntoRoundTrips } from "@/lib/backtest/metrics";
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

describe("runBacktest - 分批停利（TP1/TP2）", () => {
  it("價格先漲到 TP1 出一半部位，再漲到 TP2 出清剩餘部位", () => {
    const candles: Candle[] = [
      candle(0, 100, 100.1, 99.9, 100),
      candle(1, 100, 100.1, 99.9, 100), // 訊號在此根
      candle(2, 100, 100.5, 99.5, 100.2), // 進場根（開盤進場）
      candle(3, 100.2, 104, 100, 103.5), // 觸及 TP1（entry*1.03≈103.05）
      candle(4, 103.5, 103.6, 101, 102), // 持平
      candle(5, 102, 111, 101, 109), // 觸及 TP2（entry*1.08≈108.05）
    ];
    const signals = [bullishSignalAt(candles[1]!)];
    const config = fullRangeConfig(candles, {
      splitTakeProfit: { tp1Pct: 3, tp1SizePct: 50, tp2Pct: 8 },
    });
    const result = runBacktest({ candles, signals, config });

    expect(result.trades.length).toBe(2);
    expect(result.trades[0]!.tpStage).toBe("tp1");
    expect(result.trades[0]!.exitReason).toContain("TP1");
    expect(result.trades[1]!.tpStage).toBe("tp2");
    expect(result.trades[1]!.exitReason).toContain("TP2");
    // TP1 設定出場 50%，兩筆出場數量應大致相等
    expect(result.trades[0]!.quantity).toBeCloseTo(result.trades[1]!.quantity, 6);
    expect(result.trades[0]!.pnl).toBeGreaterThan(0);
    expect(result.trades[1]!.pnl).toBeGreaterThan(0);

    const { metrics } = computeMetrics(result);
    // 雖然產生了 2 筆出場紀錄，但只是同一次進場的分批出場，應合併計為 1 筆交易
    expect(metrics.tradeCount).toBe(1);
    expect(metrics.winRatePct).toBe(100);
  });

  it("TP1 先鎖住部分獲利，剩餘部位之後觸發停損，淨損益為負時勝率不會被 TP1 的小賺灌水", () => {
    const candles: Candle[] = [
      candle(0, 100, 100.1, 99.9, 100),
      candle(1, 100, 100.1, 99.9, 100), // 訊號在此根
      candle(2, 100, 100.5, 99.5, 100.2), // 進場根
      candle(3, 100.2, 104, 100, 103.5), // 觸及 TP1（entry*1.03=103）
      candle(4, 103.5, 103.6, 79, 80), // 剩餘部位觸發停損（entry*0.8=80）
    ];
    const signals = [bullishSignalAt(candles[1]!)];
    const config = fullRangeConfig(candles, {
      feeRatePct: 0,
      slippageRatePct: 0,
      stopLossPct: 20,
      splitTakeProfit: { tp1Pct: 3, tp1SizePct: 50, tp2Pct: 8 },
    });
    const result = runBacktest({ candles, signals, config });

    expect(result.trades.length).toBe(2);
    expect(result.trades[0]!.tpStage).toBe("tp1");
    expect(result.trades[0]!.pnl).toBeCloseTo(1500, 0);
    expect(result.trades[1]!.tpStage).toBeUndefined();
    expect(result.trades[1]!.exitReason).toContain("停損");
    expect(result.trades[1]!.pnl).toBeCloseTo(-10000, 0);

    const roundTrips = groupTradesIntoRoundTrips(result.trades);
    expect(roundTrips.length).toBe(1);
    expect(roundTrips[0]!.pnl).toBeCloseTo(-8500, 0);

    const { metrics } = computeMetrics(result);
    expect(metrics.tradeCount).toBe(1);
    expect(metrics.winRatePct).toBe(0);
  });

  it("未啟用分批停利時，合併回合與原始交易筆數相同（行為與舊版一致）", () => {
    const candles: Candle[] = [
      candle(0, 100, 100.1, 99.9, 100),
      candle(1, 100, 100.1, 99.9, 100),
      candle(2, 100, 100.5, 99.5, 100.2),
      candle(3, 100.2, 106, 100, 105),
    ];
    const signals = [bullishSignalAt(candles[1]!)];
    const config = fullRangeConfig(candles, { takeProfitPct: 4 });
    const result = runBacktest({ candles, signals, config });
    expect(result.trades.length).toBe(1);
    expect(result.trades[0]!.tpStage).toBeUndefined();
    const { metrics } = computeMetrics(result);
    expect(metrics.tradeCount).toBe(1);
  });

  it("只用訊號當根（含）之前的資料時，分批停利的出場紀錄仍與完整資料一致（無未來函數）", () => {
    const candles: Candle[] = [
      candle(0, 100, 100.1, 99.9, 100),
      candle(1, 100, 100.1, 99.9, 100),
      candle(2, 100, 100.5, 99.5, 100.2),
      candle(3, 100.2, 104, 100, 103.5),
      candle(4, 103.5, 103.6, 101, 102),
      candle(5, 102, 111, 101, 109),
    ];
    const signals = [bullishSignalAt(candles[1]!)];
    const config = fullRangeConfig(candles, {
      splitTakeProfit: { tp1Pct: 3, tp1SizePct: 50, tp2Pct: 8 },
    });
    const full = runBacktest({ candles, signals, config });

    const truncated = candles.slice(0, 4); // 截到 TP1 觸發那一根
    const truncatedConfig = fullRangeConfig(truncated, {
      splitTakeProfit: { tp1Pct: 3, tp1SizePct: 50, tp2Pct: 8 },
    });
    const partial = runBacktest({ candles: truncated, signals, config: truncatedConfig });

    // 截斷後的資料在最後一根仍持有剩餘部位，會被強制平倉多出一筆紀錄，
    // 但 TP1 這筆分批出場紀錄本身必須與完整資料中的結果完全一致，不受之後資料影響
    expect(partial.trades[0]!.tpStage).toBe("tp1");
    expect(partial.trades[0]!).toEqual(full.trades[0]!);
  });
});

describe("validateBacktestConfig - 分批停利參數驗證", () => {
  const candles: Candle[] = [
    candle(0, 100, 100.1, 99.9, 100),
    candle(1, 100, 100.1, 99.9, 100),
    candle(2, 100, 100.5, 99.5, 100.2),
  ];

  it("不可同時設定單一停利與分批停利", () => {
    const config = fullRangeConfig(candles, {
      takeProfitPct: 5,
      splitTakeProfit: { tp1Pct: 3, tp1SizePct: 50, tp2Pct: 8 },
    });
    expect(() => runBacktest({ candles, signals: [], config })).toThrow(/分批停利/);
  });

  it("TP2 必須大於 TP1", () => {
    const config = fullRangeConfig(candles, {
      splitTakeProfit: { tp1Pct: 5, tp1SizePct: 50, tp2Pct: 5 },
    });
    expect(() => runBacktest({ candles, signals: [], config })).toThrow(/TP2/);
  });

  it("TP1 出場比例必須介於 0（不含）至 100 之間", () => {
    const config = fullRangeConfig(candles, {
      splitTakeProfit: { tp1Pct: 3, tp1SizePct: 0, tp2Pct: 8 },
    });
    expect(() => runBacktest({ candles, signals: [], config })).toThrow(/TP1 出場比例/);
  });
});
