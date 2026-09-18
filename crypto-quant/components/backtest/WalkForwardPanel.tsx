"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { ErrorState, LoadingState } from "@/components/common/StatusStates";
import { useRunWalkForward } from "@/lib/client/hooks";
import { formatDate, formatPercent } from "@/lib/format";
import type { LastBacktestRun } from "@/lib/client/resultStore";

const STRATEGY_GRID_KEY: Record<string, string> = {
  "ema-trend": "shortPeriod",
  "rsi-mean-reversion": "oversold",
  "macd-trend": "fastPeriod",
  "multi-factor": "scoreThreshold",
};

function parseValues(input: string): number[] {
  return input
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
}

export function WalkForwardPanel({ run }: { run: LastBacktestRun }) {
  const defaultKey = STRATEGY_GRID_KEY[run.strategyId] ?? "shortPeriod";
  const [gridKey, setGridKey] = useState(defaultKey);
  const [gridValues, setGridValues] = useState("10,15,20,25,30");
  const [folds, setFolds] = useState(4);
  const [metricKey, setMetricKey] = useState("sharpeRatio");
  const mutation = useRunWalkForward();

  const handleRun = () => {
    mutation.mutate({
      symbol: run.symbol,
      interval: run.interval,
      strategyId: run.strategyId,
      strategyParams: run.strategyParams,
      config: run.response.config,
      paramGrid: { [gridKey]: parseValues(gridValues) },
      metricKey,
      folds,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-[var(--color-text-muted)]">
        基礎版 walk-forward 分析：將資料切成數個不重疊區塊，每塊內以前段（訓練期）挑選候選參數中表現最佳者，再套用到後段（測試期）觀察樣本外表現。訓練期挑出的「最佳參數」僅代表該區間的歷史結果，並非未來保證仍然最佳；測試期（樣本外）表現才是較貼近真實情況的參考。
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Field label="搜尋參數">
          <TextInput value={gridKey} onChange={(e) => setGridKey(e.target.value)} />
        </Field>
        <Field label="候選數值（逗號分隔）">
          <TextInput value={gridValues} onChange={(e) => setGridValues(e.target.value)} />
        </Field>
        <Field label="區塊數">
          <TextInput type="number" min={1} max={8} value={folds} onChange={(e) => setFolds(Number(e.target.value))} />
        </Field>
        <Field label="評選指標">
          <Select value={metricKey} onChange={(e) => setMetricKey(e.target.value)}>
            <option value="sharpeRatio">Sharpe Ratio</option>
            <option value="totalReturnPct">總報酬率</option>
            <option value="calmarRatio">Calmar Ratio</option>
          </Select>
        </Field>
      </div>
      <Button onClick={handleRun} disabled={mutation.isPending} className="w-fit">
        {mutation.isPending ? "分析中…" : "執行 walk-forward 分析"}
      </Button>

      {mutation.isPending && <LoadingState label="正在執行 walk-forward 分析…" />}
      {mutation.isError && <ErrorState message={mutation.error instanceof Error ? mutation.error.message : "分析失敗"} />}
      {mutation.data && (
        <>
          {mutation.data.warnings.length > 0 && (
            <div className="rounded-md border border-[var(--color-warn)]/40 bg-[var(--color-warn)]/10 p-2 text-xs text-[var(--color-warn)]">
              {mutation.data.warnings.join("；")}
            </div>
          )}
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[640px] text-xs">
              <thead className="text-[var(--color-text-muted)]">
                <tr>
                  <th className="p-2 text-left">區塊</th>
                  <th className="p-2 text-left">訓練期</th>
                  <th className="p-2 text-left">測試期</th>
                  <th className="p-2 text-left">最佳參數（僅該訓練期）</th>
                  <th className="p-2 text-right">測試期總報酬率</th>
                  <th className="p-2 text-right">測試期 Sharpe</th>
                  <th className="p-2 text-right">測試期交易次數</th>
                </tr>
              </thead>
              <tbody>
                {mutation.data.folds.map((f) => (
                  <tr key={f.foldIndex} className="border-t border-[var(--color-border)]">
                    <td className="p-2">#{f.foldIndex + 1}</td>
                    <td className="p-2">
                      {formatDate(f.trainStart)} ~ {formatDate(f.trainEnd)}
                    </td>
                    <td className="p-2">
                      {formatDate(f.testStart)} ~ {formatDate(f.testEnd)}
                    </td>
                    <td className="p-2">{JSON.stringify(f.bestParams)}</td>
                    <td className="p-2 text-right">{formatPercent(f.testMetrics.totalReturnPct)}</td>
                    <td className="p-2 text-right">{f.testMetrics.sharpeRatio?.toFixed(2) ?? "—"}</td>
                    <td className="p-2 text-right">{f.testMetrics.tradeCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
