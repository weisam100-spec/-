import { emaTrendStrategy, type EmaTrendParams } from "./emaTrend";
import { rsiMeanReversionStrategy, type RsiMeanReversionParams } from "./rsiMeanReversion";
import { macdTrendStrategy, type MacdTrendParams } from "./macdTrend";
import { multiFactorStrategy, type MultiFactorParams } from "./multiFactor";
import { smcStrategy, type SmcParams } from "./smc";
import { smtStrategy, type SmtParams } from "./smt";
import { trendPullbackEmaStrategy, type TrendPullbackEmaParams } from "./trendPullbackEma";
import { breakoutRetestStrategy, type BreakoutRetestParams } from "./breakoutRetest";
import { rangeReversalStrategy, type RangeReversalParams } from "./rangeReversal";
import { bollingerRsiReversionStrategy, type BollingerRsiReversionParams } from "./bollingerRsiReversion";
import { rsiDivergenceStructureStrategy, type RsiDivergenceStructureParams } from "./rsiDivergenceStructure";
import { vwapPullbackStrategy, type VwapPullbackParams } from "./vwapPullback";
import { falseBreakoutReclaimStrategy, type FalseBreakoutReclaimParams } from "./falseBreakoutReclaim";
import type { Strategy } from "./types";

// 策略註冊表：未來新增突破策略、網格策略、動能策略或機器學習模型，
// 只需實作 Strategy 介面並加入此表，其餘（API、回測引擎、UI 選單）皆會自動支援。
export const strategyRegistry = {
  "ema-trend": emaTrendStrategy,
  "rsi-mean-reversion": rsiMeanReversionStrategy,
  "macd-trend": macdTrendStrategy,
  "multi-factor": multiFactorStrategy,
  smc: smcStrategy,
  smt: smtStrategy,
  "trend-pullback-ema": trendPullbackEmaStrategy,
  "breakout-retest": breakoutRetestStrategy,
  "range-reversal": rangeReversalStrategy,
  "bollinger-rsi-reversion": bollingerRsiReversionStrategy,
  "rsi-divergence-structure": rsiDivergenceStructureStrategy,
  "vwap-pullback": vwapPullbackStrategy,
  "false-breakout-reclaim": falseBreakoutReclaimStrategy,
} satisfies Record<string, Strategy<Record<string, unknown>>>;

export type StrategyId = keyof typeof strategyRegistry;

export type StrategyParamsMap = {
  "ema-trend": EmaTrendParams;
  "rsi-mean-reversion": RsiMeanReversionParams;
  "macd-trend": MacdTrendParams;
  "multi-factor": MultiFactorParams;
  smc: SmcParams;
  smt: SmtParams;
  "trend-pullback-ema": TrendPullbackEmaParams;
  "breakout-retest": BreakoutRetestParams;
  "range-reversal": RangeReversalParams;
  "bollinger-rsi-reversion": BollingerRsiReversionParams;
  "rsi-divergence-structure": RsiDivergenceStructureParams;
  "vwap-pullback": VwapPullbackParams;
  "false-breakout-reclaim": FalseBreakoutReclaimParams;
};

export function isStrategyId(id: string): id is StrategyId {
  return id in strategyRegistry;
}

export function requiresCorrelatedAsset(id: StrategyId): boolean {
  return Boolean(strategyRegistry[id].requiresCorrelatedAsset);
}

export function listStrategies() {
  return (Object.keys(strategyRegistry) as StrategyId[]).map((id) => {
    const s = strategyRegistry[id];
    return {
      id,
      name: s.name,
      description: s.description,
      defaultParams: s.defaultParams,
      requiresCorrelatedAsset: Boolean(s.requiresCorrelatedAsset),
    };
  });
}

export {
  emaTrendStrategy,
  rsiMeanReversionStrategy,
  macdTrendStrategy,
  multiFactorStrategy,
  smcStrategy,
  smtStrategy,
  trendPullbackEmaStrategy,
  breakoutRetestStrategy,
  rangeReversalStrategy,
  bollingerRsiReversionStrategy,
  rsiDivergenceStructureStrategy,
  vwapPullbackStrategy,
  falseBreakoutReclaimStrategy,
};
export type {
  EmaTrendParams,
  RsiMeanReversionParams,
  MacdTrendParams,
  MultiFactorParams,
  SmcParams,
  SmtParams,
  TrendPullbackEmaParams,
  BreakoutRetestParams,
  RangeReversalParams,
  BollingerRsiReversionParams,
  RsiDivergenceStructureParams,
  VwapPullbackParams,
  FalseBreakoutReclaimParams,
};
export * from "./types";
