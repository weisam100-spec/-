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
  /** 僅跨資產比較策略（如 SMT）需要：比較交易對的同週期 K 線 */
  correlatedCandles?: Candle[];
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
  const correlatedCandles = input.correlatedCandles
    ? prepareCandles(input.correlatedCandles, input.interval).candles
    : undefined;
  const correlatedSymbol =
    typeof input.strategyParams.correlatedSymbol === "string" ? input.strategyParams.correlatedSymbol : undefined;
  const signals = strategy.generateSignals(candles, input.strategyParams as never, {
    symbol: input.symbol,
    interval: input.interval,
    correlatedCandles,
    correlatedSymbol,
  });

  const result = runBacktest({ candles, signals, config: input.config });
  result.warnings = [...prepWarnings, ...result.warnings];

  const { metrics, warnings: metricWarnings } = computeMetrics(result);

  return { result, metrics, warnings: metricWarnings, signalCount: signals.length };
}
