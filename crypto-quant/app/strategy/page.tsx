"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { ErrorState } from "@/components/common/StatusStates";
import { StrategyParamsForm } from "@/components/strategy/StrategyParamsForm";
import { BacktestConfigForm } from "@/components/strategy/BacktestConfigForm";
import { SavedConfigsPanel } from "@/components/strategy/SavedConfigsPanel";
import { useCreateStrategyConfig, useRunBacktest, useSymbols } from "@/lib/client/hooks";
import { useResultStore } from "@/lib/client/resultStore";
import { strategyRegistry, type StrategyId } from "@/lib/strategies/registry";
import { SUPPORTED_INTERVALS, INTERVAL_LABEL, type Interval } from "@/lib/market/symbols";
import { defaultBacktestConfig, type BacktestConfig } from "@/lib/backtest/types";
import type { StrategyConfigRecord } from "@/lib/storage/strategyConfigRepo";

function ninetyDaysAgo() {
  return Date.now() - 90 * 24 * 60 * 60 * 1000;
}

export default function StrategyPage() {
  const router = useRouter();
  const { data: symbolsData } = useSymbols();
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [interval, setInterval] = useState<Interval>("1h");
  const [strategyId, setStrategyId] = useState<StrategyId>("ema-trend");
  const [params, setParams] = useState<Record<string, unknown>>({ ...strategyRegistry["ema-trend"].defaultParams });
  const [config, setConfig] = useState<BacktestConfig>({
    ...defaultBacktestConfig,
    startTime: ninetyDaysAgo(),
    endTime: Date.now(),
  });
  const [saveName, setSaveName] = useState("我的策略設定");

  const runMutation = useRunBacktest();
  const createConfigMutation = useCreateStrategyConfig();
  const setLastBacktest = useResultStore((s) => s.setLastBacktest);

  const validation = useMemo(() => strategyRegistry[strategyId].validateParams(params as never), [strategyId, params]);

  const handleStrategyChange = (id: StrategyId) => {
    setStrategyId(id);
    setParams({ ...strategyRegistry[id].defaultParams });
  };

  const handleLoad = (c: StrategyConfigRecord) => {
    setSymbol(c.symbol);
    setInterval(c.interval);
    setStrategyId(c.strategyId);
    setParams(c.params);
    setConfig(c.backtestConfig);
  };

  const handleRun = async () => {
    if (!validation.valid) return;
    try {
      const response = await runMutation.mutateAsync({ symbol, interval, strategyId, strategyParams: params, config });
      setLastBacktest({
        symbol,
        interval,
        strategyId,
        strategyName: strategyRegistry[strategyId].name,
        strategyParams: params,
        runAt: Date.now(),
        response,
      });
      router.push("/backtest");
    } catch {
      // 錯誤已由 runMutation.error 呈現
    }
  };

  const handleSave = () => {
    createConfigMutation.mutate({ strategyId, name: saveName, symbol, interval, params, backtestConfig: config });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex flex-col gap-4">
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
            <Field label="策略類型">
              <Select value={strategyId} onChange={(e) => handleStrategyChange(e.target.value as StrategyId)}>
                {Object.values(strategyRegistry).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>

        <Card>
          <StrategyParamsForm strategyId={strategyId} params={params} onChange={setParams} errors={validation.errors} />
        </Card>

        <Card>
          <BacktestConfigForm config={config} onChange={setConfig} />
        </Card>

        {runMutation.isError && (
          <ErrorState message={runMutation.error instanceof Error ? runMutation.error.message : "回測執行失敗"} />
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleRun} disabled={!validation.valid || runMutation.isPending}>
            {runMutation.isPending ? "執行回測中…" : "執行回測"}
          </Button>
          <div className="flex items-center gap-2">
            <TextInput value={saveName} onChange={(e) => setSaveName(e.target.value)} className="w-48" placeholder="設定名稱" />
            <Button variant="secondary" onClick={handleSave} disabled={createConfigMutation.isPending}>
              儲存設定
            </Button>
          </div>
          {!validation.valid && <span className="text-xs text-[var(--color-down)]">請先修正策略參數錯誤</span>}
        </div>
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>已儲存的策略設定</CardTitle>
        </CardHeader>
        <SavedConfigsPanel onLoad={handleLoad} />
      </Card>
    </div>
  );
}
