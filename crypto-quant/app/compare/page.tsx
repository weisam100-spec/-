"use client";

import { useMemo, useState } from "react";
import { RiskBanner } from "@/components/common/RiskBanner";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Select } from "@/components/ui/Field";
import { Checkbox } from "@/components/ui/Field";
import { BacktestConfigForm } from "@/components/strategy/BacktestConfigForm";
import { ErrorState, LoadingState, EmptyState } from "@/components/common/StatusStates";
import { useRunCompare, useSymbols } from "@/lib/client/hooks";
import { strategyRegistry, type StrategyId } from "@/lib/strategies/registry";
import { SUPPORTED_INTERVALS, INTERVAL_LABEL, type Interval } from "@/lib/market/symbols";
import { defaultBacktestConfig, type BacktestConfig } from "@/lib/backtest/types";
import { formatPercent } from "@/lib/format";

type SortMode = "return" | "risk" | "riskAdjusted";

export default function ComparePage() {
  const { data: symbolsData } = useSymbols();
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [interval, setInterval] = useState<Interval>("1h");
  const [config, setConfig] = useState<BacktestConfig>({
    ...defaultBacktestConfig,
    startTime: Date.now() - 180 * 24 * 60 * 60 * 1000,
    endTime: Date.now(),
  });
  const [selected, setSelected] = useState<StrategyId[]>(["ema-trend", "rsi-mean-reversion", "macd-trend", "multi-factor"]);
  const [sortMode, setSortMode] = useState<SortMode>("riskAdjusted");

  const mutation = useRunCompare();

  const toggle = (id: StrategyId) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleRun = () => {
    if (selected.length === 0) return;
    mutation.mutate({
      symbol,
      interval,
      config,
      strategies: selected.map((id) => ({ strategyId: id, strategyParams: strategyRegistry[id].defaultParams, label: strategyRegistry[id].name })),
    });
  };

  const sorted = useMemo(() => {
    const list = mutation.data?.comparisons ?? [];
    const ok = list.filter((c) => c.ok && c.metrics);
    const failed = list.filter((c) => !c.ok);
    ok.sort((a, b) => {
      const ma = a.metrics!;
      const mb = b.metrics!;
      if (sortMode === "return") return mb.totalReturnPct - ma.totalReturnPct;
      if (sortMode === "risk") return ma.maxDrawdownPct - mb.maxDrawdownPct;
      return (mb.sharpeRatio ?? -Infinity) - (ma.sharpeRatio ?? -Infinity);
    });
    return [...ok, ...failed];
  }, [mutation.data, sortMode]);

  return (
    <div className="flex flex-col gap-4">
      <RiskBanner />
      <h1 className="text-lg font-bold text-[var(--color-text)]">策略比較</h1>

      <Card>
        <CardHeader>
          <CardTitle>共同條件</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        </div>
        <div className="mt-3">
          <BacktestConfigForm config={config} onChange={setConfig} />
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>選擇要比較的策略（皆使用各自預設參數）</CardTitle>
        </CardHeader>
        <div className="flex flex-wrap gap-3">
          {Object.values(strategyRegistry).map((s) => (
            <Checkbox key={s.id} label={s.name} checked={selected.includes(s.id as StrategyId)} onChange={() => toggle(s.id as StrategyId)} />
          ))}
        </div>
        <Button className="mt-3" onClick={handleRun} disabled={mutation.isPending || selected.length === 0}>
          {mutation.isPending ? "比較執行中…" : "執行策略比較"}
        </Button>
      </Card>

      {mutation.isPending && <LoadingState label="正在執行策略比較…" />}
      {mutation.isError && <ErrorState message={mutation.error instanceof Error ? mutation.error.message : "比較執行失敗"} />}

      {mutation.data && (
        <Card>
          <CardHeader>
            <CardTitle>比較結果</CardTitle>
            <Field label="排序依據">
              <Select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)} className="w-40">
                <option value="return">依報酬率</option>
                <option value="risk">依風險（回撤越低越前）</option>
                <option value="riskAdjusted">依風險調整後報酬（Sharpe）</option>
              </Select>
            </Field>
          </CardHeader>
          <p className="mb-3 text-xs text-[var(--color-warn)]">{mutation.data.disclaimer}</p>
          {sorted.length === 0 ? (
            <EmptyState message="沒有比較結果" />
          ) : (
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full min-w-[640px] text-xs">
                <thead className="text-[var(--color-text-muted)]">
                  <tr>
                    <th className="p-2 text-left">策略</th>
                    <th className="p-2 text-right">總報酬率</th>
                    <th className="p-2 text-right">最大回撤</th>
                    <th className="p-2 text-right">Sharpe Ratio</th>
                    <th className="p-2 text-right">勝率</th>
                    <th className="p-2 text-right">交易次數</th>
                    <th className="p-2 text-right">獲利因子</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((c) => (
                    <tr key={c.strategyId} className="border-t border-[var(--color-border)]">
                      <td className="p-2 font-medium text-[var(--color-text)]">{c.label}</td>
                      {c.ok && c.metrics ? (
                        <>
                          <td className={`p-2 text-right ${c.metrics.totalReturnPct >= 0 ? "pos" : "neg"}`}>{formatPercent(c.metrics.totalReturnPct)}</td>
                          <td className="p-2 text-right">{c.metrics.maxDrawdownPct.toFixed(2)}%</td>
                          <td className="p-2 text-right">{c.metrics.sharpeRatio?.toFixed(2) ?? "—"}</td>
                          <td className="p-2 text-right">{c.metrics.winRatePct?.toFixed(1) ?? "—"}%</td>
                          <td className="p-2 text-right">{c.metrics.tradeCount}</td>
                          <td className="p-2 text-right">{c.metrics.profitFactor === null ? "—" : c.metrics.profitFactor === Infinity ? "∞" : c.metrics.profitFactor.toFixed(2)}</td>
                        </>
                      ) : (
                        <td colSpan={6} className="p-2 text-[var(--color-down)]">
                          {c.error ?? "執行失敗"}
                        </td>
                      )}
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
