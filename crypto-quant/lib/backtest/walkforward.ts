import type { PerformanceMetrics } from "./metrics";
import { runStrategyBacktest, type PipelineInput } from "./runPipeline";

export interface WalkForwardFold {
  foldIndex: number;
  trainStart: number;
  trainEnd: number;
  testStart: number;
  testEnd: number;
  bestParams: Record<string, unknown>;
  trainMetricValue: number | null;
  testMetrics: PerformanceMetrics;
}

export interface WalkForwardResult {
  folds: WalkForwardFold[];
  warnings: string[];
  metricKey: keyof PerformanceMetrics;
}

const MAX_COMBOS = 30;
const MAX_FOLDS = 8;
const MIN_WINDOW_BARS = 40;

function cartesianProduct(paramGrid: Record<string, number[]>): Record<string, number>[] {
  const keys = Object.keys(paramGrid);
  if (keys.length === 0) return [{}];
  let combos: Record<string, number>[] = [{}];
  for (const key of keys) {
    const values = paramGrid[key]!;
    const next: Record<string, number>[] = [];
    for (const combo of combos) {
      for (const v of values) next.push({ ...combo, [key]: v });
    }
    combos = next;
  }
  return combos;
}

/**
 * 基礎版 walk-forward analysis：
 * 將資料切成多個不重疊的區塊，每塊內以前段（訓練期）從候選參數組合中
 * 挑出在指定指標下表現最佳者，再套用到後段（測試期）評估樣本外表現。
 * 任何「最佳參數」都只代表該訓練區間內的結果，不代表未來仍然最佳。
 */
export function runWalkForward(
  base: PipelineInput,
  paramGrid: Record<string, number[]>,
  metricKey: keyof PerformanceMetrics,
  folds = 4,
  trainRatio = 0.7,
): WalkForwardResult {
  const warnings: string[] = [];
  const combos = cartesianProduct(paramGrid);
  if (combos.length > MAX_COMBOS) {
    throw new Error(`候選參數組合過多（${combos.length} 組，上限 ${MAX_COMBOS}），請縮小參數搜尋範圍`);
  }
  const foldCount = Math.min(Math.max(1, folds), MAX_FOLDS);

  const candles = base.candles.filter((c) => c.openTime >= base.config.startTime && c.openTime <= base.config.endTime);
  if (candles.length < MIN_WINDOW_BARS * foldCount) {
    warnings.push(
      `資料量（${candles.length} 根 K 棒）對 ${foldCount} 個區塊而言明顯不足，walk-forward 結果僅供參考，建議增加資料區間或減少區塊數`,
    );
  }

  const foldLen = Math.floor(candles.length / foldCount);
  const results: WalkForwardFold[] = [];

  for (let f = 0; f < foldCount; f++) {
    const windowStart = f * foldLen;
    const windowEnd = f === foldCount - 1 ? candles.length : (f + 1) * foldLen;
    const windowCandles = candles.slice(windowStart, windowEnd);
    if (windowCandles.length < MIN_WINDOW_BARS) {
      warnings.push(`第 ${f + 1} 區塊資料量過少（${windowCandles.length} 根），已略過`);
      continue;
    }
    const trainCount = Math.max(20, Math.floor(windowCandles.length * trainRatio));
    const trainCandles = windowCandles.slice(0, trainCount);
    const testCandles = windowCandles.slice(trainCount);
    if (testCandles.length < 10) {
      warnings.push(`第 ${f + 1} 區塊測試期資料量過少，已略過`);
      continue;
    }

    const trainStart = trainCandles[0]!.openTime;
    const trainEnd = trainCandles[trainCandles.length - 1]!.openTime;
    const testStart = testCandles[0]!.openTime;
    const testEnd = testCandles[testCandles.length - 1]!.openTime;

    let bestCombo: Record<string, number> = combos[0] ?? {};
    let bestValue = -Infinity;
    for (const combo of combos) {
      try {
        const { metrics } = runStrategyBacktest({
          ...base,
          candles: trainCandles,
          strategyParams: { ...base.strategyParams, ...combo },
          config: { ...base.config, startTime: trainStart, endTime: trainEnd },
        });
        const raw = metrics[metricKey];
        const value = typeof raw === "number" && Number.isFinite(raw) ? raw : -Infinity;
        if (value > bestValue) {
          bestValue = value;
          bestCombo = combo;
        }
      } catch {
        // 忽略不合法的參數組合
      }
    }

    const { metrics: testMetrics } = runStrategyBacktest({
      ...base,
      candles: testCandles,
      strategyParams: { ...base.strategyParams, ...bestCombo },
      config: { ...base.config, startTime: testStart, endTime: testEnd },
    });

    results.push({
      foldIndex: f,
      trainStart,
      trainEnd,
      testStart,
      testEnd,
      bestParams: bestCombo,
      trainMetricValue: Number.isFinite(bestValue) ? bestValue : null,
      testMetrics,
    });
  }

  if (results.length === 0) {
    warnings.push("所有區塊資料量皆不足，無法完成 walk-forward 分析");
  }

  return { folds: results, warnings, metricKey };
}
