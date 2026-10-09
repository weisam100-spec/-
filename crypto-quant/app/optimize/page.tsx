"use client";

import { useMemo, useState } from "react";
import { RiskBanner } from "@/components/common/RiskBanner";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Select, TextInput } from "@/components/ui/Field";
import { ErrorState, LoadingState, EmptyState } from "@/components/common/StatusStates";
import { BacktestConfigForm } from "@/components/strategy/BacktestConfigForm";
import { useRunOptimize, useSymbols } from "@/lib/client/hooks";
import { strategyRegistry, requiresCorrelatedAsset, type StrategyId } from "@/lib/strategies/registry";
import { SUPPORTED_INTERVALS, INTERVAL_LABEL, type Interval } from "@/lib/market/symbols";
import { defaultBacktestConfig, type BacktestConfig } from "@/lib/backtest/types";
import { formatPercent } from "@/lib/format";

const METRIC_OPTIONS: { key: string; label: string }[] = [
  { key: "sharpeRatio", label: "Sharpe Ratio" },
  { key: "sortinoRatio", label: "Sortino Ratio" },
  { key: "calmarRatio", label: "Calmar Ratio" },
  { key: "totalReturnPct", label: "總報酬率" },
  { key: "cagrPct", label: "年化報酬率" },
  { key: "maxDrawdownPct", label: "最大回撤（越小越好）" },
  { key: "winRatePct", label: "勝率" },
  { key: "profitFactor", label: "獲利因子" },
];

// SMT 需要額外選擇比較交易對，通用數值搜尋介面尚不支援，暫不開放參數自動優化
const OPTIMIZABLE_STRATEGY_IDS = (Object.keys(strategyRegistry) as StrategyId[]).filter((id) => !requiresCorrelatedAsset(id));

interface SweepState {
  enabled: boolean;
  min: number;
  max: number;
  step: number;
}

function numericKeysOf(params: Record<string, unknown>): string[] {
  return Object.keys(params).filter((k) => typeof params[k] === "number");
}

function buildRange(min: number, max: number, step: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(step) || step <= 0 || max < min) return [];
  const values: number[] = [];
  for (let v = min; v <= max + 1e-9 && values.length < 10; v += step) {
    values.push(Math.round(v * 1e6) / 1e6);
  }
  return values;
}

function defaultSweepFor(key: string, defaultValue: number): SweepState {
  const isIntLike = Number.isInteger(defaultValue);
  const span = Math.max(Math.abs(defaultValue) * 0.5, isIntLike ? 5 : 1);
  const min = isIntLike ? Math.max(1, Math.round(defaultValue - span)) : Number((defaultValue - span).toFixed(4));
  const max = isIntLike ? Math.round(defaultValue + span) : Number((defaultValue + span).toFixed(4));
  const step = isIntLike ? Math.max(1, Math.round(span / 4)) : Number((span / 4).toFixed(4));
  return { enabled: false, min, max, step };
}

function ninetyDaysAgo() {
  return Date.now() - 90 * 24 * 60 * 60 * 1000;
}

export default function OptimizePage() {
  const { data: symbolsData } = useSymbols();
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [interval, setInterval] = useState<Interval>("1h");
  const [strategyId, setStrategyId] = useState<StrategyId>("ema-trend");
  const [params, setParams] = useState<Record<string, unknown>>({ ...strategyRegistry["ema-trend"].defaultParams });
  const [sweep, setSweep] = useState<Record<string, SweepState>>(() => {
    const defaults = strategyRegistry["ema-trend"].defaultParams as Record<string, unknown>;
    const out: Record<string, SweepState> = {};
    for (const key of numericKeysOf(defaults)) out[key] = defaultSweepFor(key, defaults[key] as number);
    return out;
  });
  const [config, setConfig] = useState<BacktestConfig>({
    ...defaultBacktestConfig,
    startTime: ninetyDaysAgo(),
    endTime: Date.now(),
  });
  const [metricKey, setMetricKey] = useState("sharpeRatio");
  const [topN, setTopN] = useState(10);

  const mutation = useRunOptimize();

  const numericKeys = useMemo(() => numericKeysOf(params), [params]);
  const nonNumericKeys = useMemo(
    () => Object.keys(params).filter((k) => typeof params[k] !== "number"),
    [params],
  );

  const handleStrategyChange = (id: StrategyId) => {
    setStrategyId(id);
    const defaults = { ...strategyRegistry[id].defaultParams } as Record<string, unknown>;
    setParams(defaults);
    const out: Record<string, SweepState> = {};
    for (const key of numericKeysOf(defaults)) out[key] = defaultSweepFor(key, defaults[key] as number);
    setSweep(out);
  };

  const paramGrid = useMemo(() => {
    const entries: [string, number[]][] = [];
    for (const key of numericKeys) {
      const s = sweep[key];
      if (s?.enabled) entries.push([key, buildRange(s.min, s.max, s.step)]);
    }
    return Object.fromEntries(entries) as Record<string, number[]>;
  }, [numericKeys, sweep]);

  const sweptKeys = Object.keys(paramGrid);
  const totalCombos = sweptKeys.reduce((a, k) => a * (paramGrid[k]?.length ?? 0), sweptKeys.length > 0 ? 1 : 0);
  const comboLimitExceeded = totalCombos > 300;
  const anyInvalidRange = sweptKeys.some((k) => (paramGrid[k]?.length ?? 0) === 0);
  const canSubmit = sweptKeys.length > 0 && !comboLimitExceeded && !anyInvalidRange;

  const handleRun = () => {
    if (!canSubmit) return;
    mutation.mutate({
      symbol,
      interval,
      strategyId,
      strategyParams: params,
      config,
      paramGrid,
      metricKey,
      topN,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <RiskBanner />
      <h1 className="text-lg font-bold text-[var(--color-text)]">參數自動優化</h1>
      <p className="text-sm text-[var(--color-text-muted)]">
        在你指定的範圍內窮舉參數組合、對同一段歷史資料各跑一次回測，依指定指標排序列出表現最好的組合。這只是「事後」在歷史資料上找出表現最好的參數，組合數越多、歷史資料越短，就越容易只是運氣好而非真正穩健（過度擬合），結果不是投資建議，請務必搭配下方「
        <a href="/backtest" className="text-[var(--color-accent)] hover:underline">
          回測結果頁的 Walk-Forward 分析
        </a>
        」驗證樣本外表現後再決定是否採用。
      </p>

      <Card>
        <CardHeader>
          <CardTitle>基本設定</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="交易對">
            <Select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
              {(symbolsData?.symbols ?? []).map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.displayName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="K 線週期">
            <Select value={interval} onChange={(e) => setInterval(e.target.value as Interval)}>
              {SUPPORTED_INTERVALS.map((iv) => (
                <option key={iv} value={iv}>
                  {INTERVAL_LABEL[iv]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="策略類型" hint="需要額外選擇比較交易對的跨資產策略（SMT）尚不支援參數自動優化">
            <Select value={strategyId} onChange={(e) => handleStrategyChange(e.target.value as StrategyId)}>
              {OPTIMIZABLE_STRATEGY_IDS.map((id) => (
                <option key={id} value={id}>
                  {strategyRegistry[id].name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="mt-3">
          <BacktestConfigForm config={config} onChange={setConfig} />
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>要搜尋的參數範圍</CardTitle>
        </CardHeader>
        <p className="mb-2 text-xs text-[var(--color-text-muted)]">
          勾選要搜尋的數值型參數並設定範圍／間距；未勾選的參數維持右側目前設定的固定值。
        </p>
        <div className="flex flex-col gap-2">
          {numericKeys.map((key) => {
            const s = sweep[key] ?? defaultSweepFor(key, (params[key] as number) ?? 0);
            const values = s.enabled ? buildRange(s.min, s.max, s.step) : [];
            return (
              <div key={key} className="rounded-md border border-[var(--color-border)] p-2">
                <div className="flex flex-wrap items-center gap-3">
                  <Checkbox
                    label={key}
                    checked={s.enabled}
                    onChange={(e) => setSweep((prev) => ({ ...prev, [key]: { ...s, enabled: e.target.checked } }))}
                  />
                  {s.enabled ? (
                    <>
                      <Field label="最小值">
                        <TextInput
                          type="number"
                          className="w-24"
                          value={s.min}
                          onChange={(e) => setSweep((prev) => ({ ...prev, [key]: { ...s, min: Number(e.target.value) } }))}
                        />
                      </Field>
                      <Field label="最大值">
                        <TextInput
                          type="number"
                          className="w-24"
                          value={s.max}
                          onChange={(e) => setSweep((prev) => ({ ...prev, [key]: { ...s, max: Number(e.target.value) } }))}
                        />
                      </Field>
                      <Field label="間距">
                        <TextInput
                          type="number"
                          className="w-24"
                          value={s.step}
                          onChange={(e) => setSweep((prev) => ({ ...prev, [key]: { ...s, step: Number(e.target.value) } }))}
                        />
                      </Field>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {values.length === 0 ? "範圍不合法" : `${values.length} 個數值：${values.join(", ")}`}
                      </span>
                    </>
                  ) : (
                    <Field label="固定值">
                      <TextInput
                        type="number"
                        className="w-28"
                        value={(params[key] as number) ?? 0}
                        onChange={(e) => setParams((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                      />
                    </Field>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {nonNumericKeys.length > 0 && (
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">
            其他參數（{nonNumericKeys.join("、")}）非數值型，固定維持目前設定，不會納入自動搜尋。
          </p>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>評選設定</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="評選指標">
            <Select value={metricKey} onChange={(e) => setMetricKey(e.target.value)}>
              {METRIC_OPTIONS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="顯示前幾名">
            <TextInput type="number" min={1} max={50} value={topN} onChange={(e) => setTopN(Number(e.target.value))} />
          </Field>
          <div className="flex items-end">
            <span className="text-xs text-[var(--color-text-muted)]">
              {sweptKeys.length === 0
                ? "請至少勾選一個要搜尋的參數"
                : comboLimitExceeded
                  ? `組合數過多（${totalCombos} 組，上限 300），請縮小範圍`
                  : anyInvalidRange
                    ? "有參數的範圍設定不合法"
                    : `將測試 ${totalCombos} 組參數組合`}
            </span>
          </div>
        </div>
        <Button className="mt-3" onClick={handleRun} disabled={!canSubmit || mutation.isPending}>
          {mutation.isPending ? "優化執行中…" : "執行參數自動優化"}
        </Button>
      </Card>

      {mutation.isPending && <LoadingState label="正在窮舉參數組合並執行回測…" />}
      {mutation.isError && <ErrorState message={mutation.error instanceof Error ? mutation.error.message : "執行失敗"} />}

      {mutation.data && (
        <Card>
          <CardHeader>
            <CardTitle>
              結果（共測試 {mutation.data.totalCombos} 組，{mutation.data.evaluatedCombos} 組成功計算指標）
            </CardTitle>
          </CardHeader>
          <p className="mb-3 text-xs text-[var(--color-warn)]">{mutation.data.disclaimer}</p>
          {mutation.data.warnings.length > 0 && (
            <div className="mb-3 flex flex-col gap-1">
              {mutation.data.warnings.map((w, i) => (
                <div key={i} className="rounded-md border border-[var(--color-warn)]/40 bg-[var(--color-warn)]/10 px-2 py-1.5 text-xs text-[var(--color-warn)]">
                  ⚠ {w}
                </div>
              ))}
            </div>
          )}
          {mutation.data.ranked.length === 0 ? (
            <EmptyState message="沒有可用的結果" />
          ) : (
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full min-w-[720px] text-xs">
                <thead className="text-[var(--color-text-muted)]">
                  <tr>
                    <th className="p-2 text-left">排名</th>
                    <th className="p-2 text-left">參數組合</th>
                    <th className="p-2 text-right">{METRIC_OPTIONS.find((m) => m.key === metricKey)?.label ?? metricKey}</th>
                    <th className="p-2 text-right">總報酬率</th>
                    <th className="p-2 text-right">最大回撤</th>
                    <th className="p-2 text-right">Sharpe</th>
                    <th className="p-2 text-right">交易次數</th>
                  </tr>
                </thead>
                <tbody>
                  {mutation.data.ranked.map((c, i) => (
                    <tr key={i} className={`border-t border-[var(--color-border)] ${i === 0 ? "bg-[var(--color-accent-soft)]/40" : ""}`}>
                      <td className="p-2 font-medium text-[var(--color-text)]">#{i + 1}</td>
                      <td className="p-2">{JSON.stringify(c.params)}</td>
                      <td className="p-2 text-right">{c.metricValue === null ? "—" : c.metricValue.toFixed(3)}</td>
                      <td className={`p-2 text-right ${c.metrics.totalReturnPct >= 0 ? "pos" : "neg"}`}>{formatPercent(c.metrics.totalReturnPct)}</td>
                      <td className="p-2 text-right">{c.metrics.maxDrawdownPct.toFixed(2)}%</td>
                      <td className="p-2 text-right">{c.metrics.sharpeRatio?.toFixed(2) ?? "—"}</td>
                      <td className="p-2 text-right">{c.metrics.tradeCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
