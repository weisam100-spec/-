import { describe, it, expect } from "vitest";
import { runParameterOptimization } from "@/lib/backtest/optimize";
import { fvgSupplyDemandStrategy } from "@/lib/strategies/fvgSupplyDemand";
import { defaultBacktestConfig } from "@/lib/backtest/types";
import { buildNoisyCandles } from "./fixtures/sampleCandles";
import type { PipelineInput } from "@/lib/backtest/runPipeline";

const candles = buildNoisyCandles(300, 7);

function baseInput(overrides: Partial<PipelineInput> = {}): PipelineInput {
  return {
    symbol: "BTCUSDT",
    interval: "1h",
    candles,
    strategyId: "fvg-supply-demand",
    strategyParams: { ...fvgSupplyDemandStrategy.defaultParams },
    config: {
      ...defaultBacktestConfig,
      startTime: candles[0]!.openTime,
      endTime: candles[candles.length - 1]!.openTime,
    },
    ...overrides,
  };
}

describe("runParameterOptimization", () => {
  it("依指標由高到低排序（總報酬率）", () => {
    const result = runParameterOptimization(baseInput(), { swingLookback: [3, 5, 8] }, "totalReturnPct", 10);
    expect(result.totalCombos).toBe(3);
    for (let i = 1; i < result.ranked.length; i++) {
      const prev = result.ranked[i - 1]!.metricValue;
      const cur = result.ranked[i]!.metricValue;
      if (prev !== null && cur !== null) expect(prev).toBeGreaterThanOrEqual(cur);
    }
  });

  it("越小越好的指標（最大回撤）會由低到高排序", () => {
    const result = runParameterOptimization(baseInput(), { swingLookback: [3, 5, 8] }, "maxDrawdownPct", 10);
    for (let i = 1; i < result.ranked.length; i++) {
      const prev = result.ranked[i - 1]!.metricValue;
      const cur = result.ranked[i]!.metricValue;
      if (prev !== null && cur !== null) expect(prev).toBeLessThanOrEqual(cur);
    }
  });

  it("不合法的參數組合（擺動點確認根數超出上限）會被略過，不會讓整個優化失敗", () => {
    const result = runParameterOptimization(
      baseInput(),
      { swingLookback: [5, 15, 60] }, // 60 超過上限 50，應被跳過
      "totalReturnPct",
      10,
    );
    expect(result.evaluatedCombos).toBeLessThan(result.totalCombos);
    expect(result.ranked.every((r) => (r.params.swingLookback as number) <= 50)).toBe(true);
  });

  it("候選組合數超過上限時拋出明確錯誤", () => {
    expect(() =>
      runParameterOptimization(
        baseInput(),
        {
          swingLookback: Array.from({ length: 10 }, (_, i) => i + 2),
          orderBlockLookback: Array.from({ length: 31 }, (_, i) => i + 5),
        },
        "totalReturnPct",
        10,
      ),
    ).toThrow(/上限/);
  });

  it("沒有指定任何搜尋參數時拋出錯誤", () => {
    expect(() => runParameterOptimization(baseInput(), {}, "totalReturnPct", 10)).toThrow(/至少指定/);
  });

  it("組合數超過 50 時會附帶過度擬合警告", () => {
    const result = runParameterOptimization(
      baseInput(),
      {
        swingLookback: Array.from({ length: 10 }, (_, i) => i + 2),
        orderBlockLookback: Array.from({ length: 6 }, (_, i) => i * 5 + 5),
      },
      "totalReturnPct",
      10,
    );
    expect(result.totalCombos).toBe(60);
    expect(result.warnings.some((w) => w.includes("過度擬合"))).toBe(true);
  });

  it("topN 限制回傳數量", () => {
    const result = runParameterOptimization(baseInput(), { swingLookback: [3, 4, 5, 6, 8] }, "totalReturnPct", 2);
    expect(result.ranked.length).toBeLessThanOrEqual(2);
  });
});
