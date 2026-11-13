import { fvgSupplyDemandStrategy, type FvgSupplyDemandParams } from "./fvgSupplyDemand";
import type { Strategy } from "./types";

// 策略註冊表：未來新增突破策略、網格策略、動能策略或機器學習模型，
// 只需實作 Strategy 介面並加入此表，其餘（API、回測引擎、UI 選單）皆會自動支援。
export const strategyRegistry = {
  "fvg-supply-demand": fvgSupplyDemandStrategy,
} satisfies Record<string, Strategy<Record<string, unknown>>>;

export type StrategyId = keyof typeof strategyRegistry;

export type StrategyParamsMap = {
  "fvg-supply-demand": FvgSupplyDemandParams;
};

export function isStrategyId(id: string): id is StrategyId {
  return id in strategyRegistry;
}

export function requiresCorrelatedAsset(id: StrategyId): boolean {
  return Boolean(strategyRegistry[id].requiresCorrelatedAsset);
}

export function requiresHigherTimeframe(id: StrategyId): boolean {
  return Boolean(strategyRegistry[id].requiresHigherTimeframe);
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
      requiresHigherTimeframe: Boolean(s.requiresHigherTimeframe),
    };
  });
}

export { fvgSupplyDemandStrategy };
export type { FvgSupplyDemandParams };
export * from "./types";
