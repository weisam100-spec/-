"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { ErrorState, LoadingState } from "@/components/common/StatusStates";
import { SensitivityHeatmap } from "@/components/charts/SensitivityHeatmap";
import { useRunSensitivity } from "@/lib/client/hooks";
import type { LastBacktestRun } from "@/lib/client/resultStore";

const STRATEGY_AXIS_OPTIONS: Record<string, { key: string; label: string }[]> = {
  "ema-trend": [
    { key: "shortPeriod", label: "短期 EMA 週期" },
    { key: "longPeriod", label: "長期 EMA 週期" },
  ],
  "rsi-mean-reversion": [
    { key: "oversold", label: "超賣門檻" },
    { key: "overbought", label: "超買門檻" },
    { key: "period", label: "RSI 週期" },
  ],
  "macd-trend": [
    { key: "fastPeriod", label: "快線週期" },
    { key: "slowPeriod", label: "慢線週期" },
  ],
  "multi-factor": [
    { key: "scoreThreshold", label: "訊號門檻" },
    { key: "riskVolatilityMultiple", label: "風險波動度倍數" },
  ],
};

const CONFIG_AXIS_OPTIONS = [
  { key: "stopLossPct", label: "停損比例（%）" },
  { key: "takeProfitPct", label: "停利比例（%）" },
  { key: "positionSizePct", label: "每次投入比例（%）" },
];

function parseValues(input: string): number[] {
  return input
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
}

export function SensitivityPanel({ run }: { run: LastBacktestRun }) {
  const strategyOptions = STRATEGY_AXIS_OPTIONS[run.strategyId] ?? [];
  const [xKey, setXKey] = useState(strategyOptions[0]?.key ?? "");
  const [yKey, setYKey] = useState(strategyOptions[1]?.key ?? CONFIG_AXIS_OPTIONS[0]!.key);
  const [xTarget, setXTarget] = useState<"strategy" | "config">("strategy");
  const [yTarget, setYTarget] = useState<"strategy" | "config">(strategyOptions[1] ? "strategy" : "config");
  const [xValues, setXValues] = useState("10,15,20,25,30");
  const [yValues, setYValues] = useState("40,50,60,70,80");
  const [metricKey, setMetricKey] = useState("totalReturnPct");

  const mutation = useRunSensitivity();

  const allOptions = (target: "strategy" | "config") => (target === "strategy" ? strategyOptions : CONFIG_AXIS_OPTIONS);

  const handleRun = () => {
    const xLabel = allOptions(xTarget).find((o) => o.key === xKey)?.label ?? xKey;
    const yLabel = allOptions(yTarget).find((o) => o.key === yKey)?.label ?? yKey;
    mutation.mutate({
      symbol: run.symbol,
      interval: run.interval,
      strategyId: run.strategyId,
      strategyParams: run.strategyParams,
      config: run.response.config,
      xAxis: { target: xTarget, key: xKey, label: xLabel, values: parseValues(xValues) },
      yAxis: { target: yTarget, key: yKey, label: yLabel, values: parseValues(yValues) },
      metricKey,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-[var(--color-text-muted)]">
        敏感度分析會在固定其餘條件下，測試兩個參數的不同組合對績效指標的影響，協助觀察策略對參數的穩健程度。任何看似較佳的組合都只反映此歷史區間，不保證未來仍然最佳。
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-md border border-[var(--color-border)] p-2">
          <p className="text-xs font-semibold text-[var(--color-text)]">X 軸參數</p>
          <div className="flex gap-2">
            <Select value={xTarget} onChange={(e) => setXTarget(e.target.value as "strategy" | "config")}>
              <option value="strategy">策略參數</option>
              <option value="config">回測成本參數</option>
            </Select>
            <Select value={xKey} onChange={(e) => setXKey(e.target.value)}>
              {allOptions(xTarget).map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <Field label="數值（以逗號分隔）">
            <TextInput value={xValues} onChange={(e) => setXValues(e.target.value)} />
          </Field>
        </div>
        <div className="flex flex-col gap-2 rounded-md border border-[var(--color-border)] p-2">
          <p className="text-xs font-semibold text-[var(--color-text)]">Y 軸參數</p>
          <div className="flex gap-2">
            <Select value={yTarget} onChange={(e) => setYTarget(e.target.value as "strategy" | "config")}>
              <option value="strategy">策略參數</option>
              <option value="config">回測成本參數</option>
            </Select>
            <Select value={yKey} onChange={(e) => setYKey(e.target.value)}>
              {allOptions(yTarget).map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <Field label="數值（以逗號分隔）">
            <TextInput value={yValues} onChange={(e) => setYValues(e.target.value)} />
          </Field>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Field label="觀察指標">
          <Select value={metricKey} onChange={(e) => setMetricKey(e.target.value)}>
            <option value="totalReturnPct">總報酬率</option>
            <option value="sharpeRatio">Sharpe Ratio</option>
            <option value="maxDrawdownPct">最大回撤</option>
            <option value="winRatePct">勝率</option>
            <option value="profitFactor">獲利因子</option>
            <option value="cagrPct">年化報酬率</option>
          </Select>
        </Field>
        <Button onClick={handleRun} disabled={mutation.isPending} className="mt-5">
          {mutation.isPending ? "分析中…" : "執行敏感度分析"}
        </Button>
      </div>

      {mutation.isPending && <LoadingState label="正在計算敏感度分析…" />}
      {mutation.isError && <ErrorState message={mutation.error instanceof Error ? mutation.error.message : "分析失敗"} />}
      {mutation.data && (
        <>
          {mutation.data.warnings.length > 0 && (
            <div className="rounded-md border border-[var(--color-warn)]/40 bg-[var(--color-warn)]/10 p-2 text-xs text-[var(--color-warn)]">
              {mutation.data.warnings.join("；")}
            </div>
          )}
          <SensitivityHeatmap
            cells={mutation.data.cells}
            xLabel={allOptions(xTarget).find((o) => o.key === xKey)?.label ?? xKey}
            yLabel={allOptions(yTarget).find((o) => o.key === yKey)?.label ?? yKey}
            metricLabel={metricKey}
          />
        </>
      )}
    </div>
  );
}
