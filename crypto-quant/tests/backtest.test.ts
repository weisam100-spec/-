import { describe, it, expect } from "vitest";
import { runBacktest } from "@/lib/backtest/engine";
import { computeMetrics } from "@/lib/backtest/metrics";
import { prepareCandles } from "@/lib/backtest/dataPrep";
import { defaultBacktestConfig } from "@/lib/backtest/types";
import { emaTrendStrategy } from "@/lib/strategies/emaTrend";
import { buildSampleCandles, buildFlawedCandles } from "./fixtures/sampleCandles";
import type { Candle } from "@/lib/market/types";
import type { StrategySignal } from "@/lib/strategies/types";

const ctx = { symbol: "BTCUSDT", interval: "1h" as const };

function fullRangeConfig(candles: Candle[], overrides: Partial<typeof defaultBacktestConfig> = {}) {
  return {
    ...defaultBacktestConfig,
    startTime: candles[0]!.openTime,
    endTime: candles[candles.length - 1]!.openTime,
    ...overrides,
  };
}

describe("prepareCandles", () => {
  it("剔除重複與缺漏並回報警告", () => {
    const flawed = buildFlawedCandles();
    const { candles, warnings } = prepareCandles(flawed, "1h");
    const openTimes = candles.map((c) => c.openTime);
    expect(new Set(openTimes).size).toBe(openTimes.length);
    expect(warnings.some((w) => w.code === "duplicate_candles")).toBe(true);
    expect(warnings.some((w) => w.code === "data_gap")).toBe(true);
  });

  it("剔除異常價格（高低顛倒）", () => {
    const candles = buildSampleCandles().slice(0, 5);
    const bad: Candle = { ...candles[2]!, high: 1, low: 100 };
    const withBad = [...candles.slice(0, 2), bad, ...candles.slice(3)];
    const { candles: cleaned, warnings } = prepareCandles(withBad, "1h");
    expect(cleaned.length).toBe(candles.length - 1);
    expect(warnings.some((w) => w.code === "invalid_price")).toBe(true);
  });
});

describe("runBacktest - 無未來函數", () => {
  it("訊號時間點之後才會成交，進場時間必須晚於訊號時間", () => {
    const candles = buildSampleCandles();
    const params = { ...emaTrendStrategy.defaultParams, confirmClose: false };
    const signals = emaTrendStrategy.generateSignals(candles, params, ctx);
    const result = runBacktest({ candles, signals, config: fullRangeConfig(candles) });

    for (const trade of result.trades) {
      const triggeringSignal = signals.find((s) => s.type === "bullish_candidate" && s.time < trade.entryTime);
      expect(triggeringSignal).toBeDefined();
      expect(trade.entryTime).toBeGreaterThan(triggeringSignal!.time);
    }
  });

  it("同一根訊號不會在當根就成交（至少間隔一根 K 棒）", () => {
    const candles = buildSampleCandles();
    const signals: StrategySignal[] = [
      {
        time: candles[10]!.openTime,
        symbol: "BTCUSDT",
        interval: "1h",
        type: "bullish_candidate",
        price: candles[10]!.close,
        reason: "test",
        confidence: 80,
        params: {},
      },
    ];
    const result = runBacktest({ candles, signals, config: fullRangeConfig(candles) });
    expect(result.trades.length).toBeGreaterThan(0);
    expect(result.trades[0]!.entryTime).toBe(candles[11]!.openTime);
  });
});

describe("runBacktest - 沒有交易的情況", () => {
  it("沒有任何訊號時不產生交易，且不拋出錯誤", () => {
    const candles = buildSampleCandles();
    const result = runBacktest({ candles, signals: [], config: fullRangeConfig(candles) });
    expect(result.trades).toHaveLength(0);
    const { metrics, warnings } = computeMetrics(result);
    expect(metrics.tradeCount).toBe(0);
    expect(metrics.winRatePct).toBeNull();
    expect(metrics.profitFactor).toBeNull();
    expect(warnings.some((w) => w.code === "no_trades")).toBe(true);
  });
});

describe("runBacktest - 交易成本", () => {
  it("有手續費與滑價時，淨損益必定低於未計成本的損益", () => {
    const candles = buildSampleCandles();
    const signals: StrategySignal[] = [
      {
        time: candles[10]!.openTime,
        symbol: "BTCUSDT",
        interval: "1h",
        type: "bullish_candidate",
        price: candles[10]!.close,
        reason: "test",
        confidence: 80,
        params: {},
      },
      {
        time: candles[30]!.openTime,
        symbol: "BTCUSDT",
        interval: "1h",
        type: "bearish_candidate",
        price: candles[30]!.close,
        reason: "test",
        confidence: 80,
        params: {},
      },
    ];
    const withCost = runBacktest({
      candles,
      signals,
      config: fullRangeConfig(candles, { feeRatePct: 0.1, slippageRatePct: 0.05 }),
    });
    const withoutCost = runBacktest({
      candles,
      signals,
      config: fullRangeConfig(candles, { feeRatePct: 0, slippageRatePct: 0 }),
    });
    expect(withCost.trades[0]!.pnl).toBeLessThan(withoutCost.trades[0]!.pnl);
    expect(withCost.trades[0]!.totalCost).toBeGreaterThan(0);
    expect(withoutCost.trades[0]!.totalCost).toBeCloseTo(0, 6);
  });
});

describe("runBacktest - 停損與停利", () => {
  it("停損比例會在價格跌破時觸發出場", () => {
    // 建立一段明確下跌的 K 棒序列
    const candles: Candle[] = [];
    let price = 100;
    for (let i = 0; i < 20; i++) {
      const open = price;
      price -= i === 5 ? 8 : 0.2; // 第 5 根大跌 8%
      const close = price;
      candles.push({
        openTime: 1_700_000_000_000 + i * 3_600_000,
        open,
        high: Math.max(open, close) + 0.1,
        low: Math.min(open, close) - 0.1,
        close,
        volume: 1000,
        closed: true,
      });
    }
    const signals: StrategySignal[] = [
      {
        time: candles[1]!.openTime,
        symbol: "BTCUSDT",
        interval: "1h",
        type: "bullish_candidate",
        price: candles[1]!.close,
        reason: "test",
        confidence: 80,
        params: {},
      },
    ];
    const result = runBacktest({
      candles,
      signals,
      config: fullRangeConfig(candles, { stopLossPct: 5 }),
    });
    expect(result.trades.length).toBeGreaterThan(0);
    expect(result.trades[0]!.exitReason).toContain("停損");
  });

  it("停利比例會在價格大漲時觸發出場", () => {
    const candles: Candle[] = [];
    let price = 100;
    for (let i = 0; i < 20; i++) {
      const open = price;
      price += i === 5 ? 10 : 0.2;
      const close = price;
      candles.push({
        openTime: 1_700_000_000_000 + i * 3_600_000,
        open,
        high: Math.max(open, close) + 0.1,
        low: Math.min(open, close) - 0.1,
        close,
        volume: 1000,
        closed: true,
      });
    }
    const signals: StrategySignal[] = [
      {
        time: candles[1]!.openTime,
        symbol: "BTCUSDT",
        interval: "1h",
        type: "bullish_candidate",
        price: candles[1]!.close,
        reason: "test",
        confidence: 80,
        params: {},
      },
    ];
    const result = runBacktest({
      candles,
      signals,
      config: fullRangeConfig(candles, { takeProfitPct: 5 }),
    });
    expect(result.trades.length).toBeGreaterThan(0);
    expect(result.trades[0]!.exitReason).toContain("停利");
  });
});

describe("computeMetrics - 最大回撤與 Sharpe", () => {
  it("持續上漲的資產曲線最大回撤應為 0", () => {
    const candles = buildSampleCandles();
    const result = runBacktest({ candles, signals: [], config: fullRangeConfig(candles) });
    // 手動建立一個單調上升的權益曲線
    result.equityCurve.forEach((p, i) => {
      p.equity = 100_000 + i * 10;
    });
    const { metrics } = computeMetrics(result);
    expect(metrics.maxDrawdownPct).toBeCloseTo(0, 6);
  });

  it("V 型回撤能被正確量測", () => {
    const candles = buildSampleCandles();
    const result = runBacktest({ candles, signals: [], config: fullRangeConfig(candles) });
    result.equityCurve.forEach((p, i) => {
      if (i < 10) p.equity = 100_000 + i * 1000;
      else p.equity = 110_000 - (i - 10) * 2000;
    });
    const { metrics } = computeMetrics(result);
    expect(metrics.maxDrawdownPct).toBeGreaterThan(0);
  });

  it("波動度為 0 時 Sharpe 應為 null 而非除以零錯誤", () => {
    const candles = buildSampleCandles();
    const result = runBacktest({ candles, signals: [], config: fullRangeConfig(candles) });
    result.equityCurve.forEach((p) => {
      p.equity = 100_000;
    });
    const { metrics } = computeMetrics(result);
    expect(metrics.sharpeRatio).toBeNull();
  });
});

describe("computeMetrics - 資料不足", () => {
  it("K 棒數過少時附帶警告", () => {
    const candles = buildSampleCandles().slice(0, 10);
    const result = runBacktest({ candles, signals: [], config: fullRangeConfig(candles) });
    expect(result.warnings.some((w) => w.code === "insufficient_data")).toBe(true);
  });
});

describe("回測參數驗證", () => {
  it("日期起點不得晚於終點", () => {
    const candles = buildSampleCandles();
    expect(() =>
      runBacktest({
        candles,
        signals: [],
        config: { ...defaultBacktestConfig, startTime: candles[candles.length - 1]!.openTime, endTime: candles[0]!.openTime },
      }),
    ).toThrow();
  });

  it("投入比例超過 100% 應拋出錯誤", () => {
    const candles = buildSampleCandles();
    expect(() =>
      runBacktest({
        candles,
        signals: [],
        config: fullRangeConfig(candles, { positionSizePct: 150 }),
      }),
    ).toThrow();
  });
});
