import type { PerformanceMetrics } from "./metrics";
import { runStrategyBacktest, type PipelineInput } from "./runPipeline";

export interface SensitivityAxis {
  target: "strategy" | "config";
  key: string;
  label: string;
  values: number[];
}

export interface SensitivityCell {
  xValue: number;
  yValue: number;
  metricValue: number | null;
  tradeCount: number;
}

const MAX_CELLS = 144; // 上限 12x12，避免計算量失控

export function runSensitivityAnalysis(
  base: PipelineInput,
  xAxis: SensitivityAxis,
  yAxis: SensitivityAxis,
  metricKey: keyof PerformanceMetrics,
): { cells: SensitivityCell[]; warnings: string[] } {
  const warnings: string[] = [];
  if (xAxis.values.length * yAxis.values.length > MAX_CELLS) {
    throw new Error(`敏感度分析網格過大（上限 ${MAX_CELLS} 組合），請減少參數數值數量`);
  }

  const cells: SensitivityCell[] = [];
  for (const yValue of yAxis.values) {
    for (const xValue of xAxis.values) {
      const strategyParams = { ...base.strategyParams };
      const config = { ...base.config };
      applyAxisValue(xAxis, xValue, strategyParams, config);
      applyAxisValue(yAxis, yValue, strategyParams, config);

      try {
        const { metrics } = runStrategyBacktest({ ...base, strategyParams, config });
        const raw = metrics[metricKey];
        cells.push({
          xValue,
          yValue,
          metricValue: typeof raw === "number" && Number.isFinite(raw) ? raw : null,
          tradeCount: metrics.tradeCount,
        });
      } catch {
        cells.push({ xValue, yValue, metricValue: null, tradeCount: 0 });
      }
    }
  }

  if (cells.every((c) => c.tradeCount === 0)) {
    warnings.push("所有參數組合皆未產生交易，請確認資料區間或參數範圍是否合理");
  }

  return { cells, warnings };
}

function applyAxisValue(
  axis: SensitivityAxis,
  value: number,
  strategyParams: Record<string, unknown>,
  config: PipelineInput["config"],
) {
  if (axis.target === "strategy") {
    strategyParams[axis.key] = value;
  } else {
    (config as unknown as Record<string, unknown>)[axis.key] = value;
  }
}
