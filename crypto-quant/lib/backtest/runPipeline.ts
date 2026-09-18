import type { Interval } from "@/lib/market/symbols";
import type { Candle } from "@/lib/market/types";
import { strategyRegistry, type StrategyId } from "@/lib/strategies/registry";
import { prepareCandles } from "./dataPrep";
import { runBacktest } from "./engine";
import { computeMetrics, type MetricsWarning, type PerformanceMetrics } from "./metrics";
import type { BacktestConfig, BacktestResult } from "./types";

export interface PipelineInput {
  symbol: string;
  interval: Interval;
  candles: Candle[];
  strategyId: StrategyId;
  strategyParams: Record<string, unknown>;
  config: BacktestConfig;
}

export interface PipelineOutput {
  result: BacktestResult;
  metrics: PerformanceMetrics;
  warnings: MetricsWarning[];
  signalCount: number;
}

export function runStrategyBacktest(input: PipelineInput): PipelineOutput {
  const strategy = strategyRegistry[input.strategyId];
  const validation = strategy.validateParams(input.strategyParams as never);
  if (!validation.valid) {
    throw new Error(`策略參數不合法：${validation.errors.join("；")}`);
  }

  const { candles, warnings: prepWarnings } = prepareCandles(input.candles, input.interval);
  const signals = strategy.generateSignals(candles, input.strategyParams as never, {
    symbol: input.symbol,
    interval: input.interval,
  });

  const result = runBacktest({ candles, signals, config: input.config });
  result.warnings = [...prepWarnings, ...result.warnings];

  const { metrics, warnings: metricWarnings } = computeMetrics(result);

  return { result, metrics, warnings: metricWarnings, signalCount: signals.length };
}
