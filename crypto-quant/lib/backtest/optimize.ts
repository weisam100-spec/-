import type { PerformanceMetrics } from "./metrics";
import { runStrategyBacktest, type PipelineInput } from "./runPipeline";
import { cartesianProduct } from "./paramGrid";

export interface OptimizeCandidate {
  params: Record<string, number>;
  metricValue: number | null;
  metrics: PerformanceMetrics;
}

export interface OptimizeResult {
  ranked: OptimizeCandidate[];
  totalCombos: number;
  evaluatedCombos: number;
  metricKey: keyof PerformanceMetrics;
  warnings: string[];
}

const MAX_COMBOS = 300;

/** 這些指標數值越小代表越好（例如最大回撤），排名時需反向排序 */
const LOWER_IS_BETTER: ReadonlySet<keyof PerformanceMetrics> = new Set(["maxDrawdownPct", "annualizedVolatilityPct"]);

/**
 * 在指定的參數網格內窮舉所有組合、對同一段歷史資料各跑一次回測，
 * 依指定指標由好到差排序，回傳前 topN 名。
 *
 * 這是單一歷史區間內的「事後最佳化」，組合數越多，挑出的『最佳參數』
 * 只是恰好擬合這段歷史資料（過度擬合）的風險就越高，不代表未來仍然有效，
 * 務必搭配 walk-forward 分析觀察樣本外表現再決定是否採用。
 */
export function runParameterOptimization(
  base: PipelineInput,
  paramGrid: Record<string, number[]>,
  metricKey: keyof PerformanceMetrics,
  topN = 10,
): OptimizeResult {
  const warnings: string[] = [];
  const combos = cartesianProduct(paramGrid);
  if (Object.keys(paramGrid).length === 0) {
    throw new Error("請至少指定一個要搜尋的參數範圍");
  }
  if (combos.length > MAX_COMBOS) {
    throw new Error(`候選參數組合過多（${combos.length} 組，上限 ${MAX_COMBOS}），請縮小搜尋範圍或減少數值數量`);
  }

  const results: OptimizeCandidate[] = [];
  for (const combo of combos) {
    try {
      const { metrics } = runStrategyBacktest({
        ...base,
        strategyParams: { ...base.strategyParams, ...combo },
      });
      const raw = metrics[metricKey];
      const metricValue = typeof raw === "number" && Number.isFinite(raw) ? raw : null;
      results.push({ params: combo, metricValue, metrics });
    } catch {
      // 該組合參數不合法（例如短週期大於長週期），直接略過不計入排名
    }
  }

  if (results.length === 0) {
    warnings.push("所有候選參數組合皆不合法或無法計算指標，請檢查參數搜尋範圍是否合理");
  }

  const lowerIsBetter = LOWER_IS_BETTER.has(metricKey);
  const sorted = [...results].sort((a, b) => {
    if (a.metricValue === null && b.metricValue === null) return 0;
    if (a.metricValue === null) return 1;
    if (b.metricValue === null) return -1;
    return lowerIsBetter ? a.metricValue - b.metricValue : b.metricValue - a.metricValue;
  });

  const smallSampleCount = sorted.filter((r) => r.metrics.tradeCount < 20).length;
  if (sorted.length > 0 && smallSampleCount > sorted.length / 2) {
    warnings.push("超過半數候選組合的交易筆數低於 20 筆，排名結果可能只是統計噪音而非真實優勢");
  }
  if (combos.length > 50) {
    warnings.push(
      `本次測試了 ${combos.length} 組參數組合；組合數越多，挑出來的『最佳組合』越可能只是過度擬合這段歷史資料，而非真正穩健的參數，請務必用 Walk-forward 分析驗證樣本外表現`,
    );
  }

  return {
    ranked: sorted.slice(0, topN),
    totalCombos: combos.length,
    evaluatedCombos: results.length,
    metricKey,
    warnings,
  };
}
