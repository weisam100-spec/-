import { describe, it, expect } from "vitest";
import { runPortfolioBacktest, MAX_PORTFOLIO_LEGS, type PortfolioLegInput } from "@/lib/backtest/portfolio";
import { defaultBacktestConfig } from "@/lib/backtest/types";
import { buildNoisyCandles } from "./fixtures/sampleCandles";

const candlesA = buildNoisyCandles(300, 1);
const candlesB = buildNoisyCandles(300, 2);

function leg(overrides: Partial<PortfolioLegInput> = {}): PortfolioLegInput {
  const candles = overrides.candles ?? candlesA;
  const capitalUsdt = overrides.capitalUsdt ?? 10_000;
  return {
    label: "成分",
    symbol: "BTCUSDT",
    interval: "1h",
    strategyId: "ema-trend",
    strategyParams: { shortPeriod: 10, longPeriod: 30, confirmClose: false, confirmVolume: false, confirmRsi: false },
    candles,
    capitalUsdt,
    backtestConfig: {
      ...defaultBacktestConfig,
      initialCapitalUsdt: capitalUsdt,
      startTime: candles[0]!.openTime,
      endTime: candles[candles.length - 1]!.openTime,
    },
    ...overrides,
  };
}

describe("runPortfolioBacktest", () => {
  it("兩個成功的成分會加總成組合資產曲線，初始資金為兩者相加", () => {
    const result = runPortfolioBacktest([
      leg({ label: "A", symbol: "BTCUSDT", candles: candlesA, capitalUsdt: 10_000 }),
      leg({ label: "B", symbol: "ETHUSDT", candles: candlesB, capitalUsdt: 20_000 }),
    ]);
    expect(result.legs.every((l) => l.ok)).toBe(true);
    expect(result.combinedMetrics.initialCapital).toBe(30_000);
    expect(result.combinedEquityCurve.length).toBeGreaterThan(5);
    // 組合第一天的資產應接近兩個成分初始資金之和（尚未有績效差異前)
    expect(result.combinedEquityCurve[0]!.equity).toBeCloseTo(30_000, -2);
  });

  it("會計算成分之間的相關係數，數量為 C(n,2)", () => {
    const result = runPortfolioBacktest([
      leg({ label: "A", symbol: "BTCUSDT", candles: candlesA }),
      leg({ label: "B", symbol: "ETHUSDT", candles: candlesB }),
      leg({ label: "C", symbol: "SOLUSDT", candles: candlesA }),
    ]);
    expect(result.correlations.length).toBe(3); // C(3,2) = 3
    // A 與 C 使用完全相同的資料與策略，相關係數應接近 1
    const ac = result.correlations.find((c) => (c.legA === "A" && c.legB === "C") || (c.legA === "C" && c.legB === "A"));
    expect(ac?.correlation).not.toBeNull();
    expect(ac!.correlation!).toBeGreaterThan(0.9);
  });

  it("單一成分時沒有相關係數", () => {
    const result = runPortfolioBacktest([leg()]);
    expect(result.correlations.length).toBe(0);
  });

  it("其中一個成分參數不合法時，該成分標示失敗但不影響其他成分", () => {
    const result = runPortfolioBacktest([
      leg({ label: "好的", symbol: "BTCUSDT", candles: candlesA }),
      leg({ label: "壞的", symbol: "ETHUSDT", candles: candlesB, strategyParams: { shortPeriod: 50, longPeriod: 10 } }),
    ]);
    const good = result.legs.find((l) => l.label === "好的");
    const bad = result.legs.find((l) => l.label === "壞的");
    expect(good?.ok).toBe(true);
    expect(bad?.ok).toBe(false);
    expect(bad?.error).toBeTruthy();
  });

  it("所有成分都失敗時拋出錯誤", () => {
    expect(() =>
      runPortfolioBacktest([leg({ strategyParams: { shortPeriod: 50, longPeriod: 10 } })]),
    ).toThrow(/失敗/);
  });

  it("超過成分上限時拋出錯誤", () => {
    const legs = Array.from({ length: MAX_PORTFOLIO_LEGS + 1 }, (_, i) => leg({ label: `L${i}` }));
    expect(() => runPortfolioBacktest(legs)).toThrow(/上限/);
  });

  it("沒有任何成分時拋出錯誤", () => {
    expect(() => runPortfolioBacktest([])).toThrow(/至少/);
  });
});
