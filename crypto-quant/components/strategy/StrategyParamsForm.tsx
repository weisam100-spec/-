"use client";

import { Field, TextInput, Checkbox } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { strategyRegistry, type StrategyId } from "@/lib/strategies/registry";
import { multiFactorDefaultWeights, type MultiFactorWeights } from "@/lib/strategies/multiFactor";

type Params = Record<string, unknown>;

function num(params: Params, key: string): number {
  const v = params[key];
  return typeof v === "number" ? v : Number(v ?? 0);
}
function bool(params: Params, key: string): boolean {
  return Boolean(params[key]);
}

export function StrategyParamsForm({
  strategyId,
  params,
  onChange,
  errors,
}: {
  strategyId: StrategyId;
  params: Params;
  onChange: (next: Params) => void;
  errors: string[];
}) {
  const set = (key: string, value: unknown) => onChange({ ...params, [key]: value });
  const reset = () => onChange({ ...strategyRegistry[strategyId].defaultParams });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--color-text)]">{strategyRegistry[strategyId].name}參數</p>
        <Button variant="ghost" type="button" onClick={reset} className="!px-2 !py-1 text-xs">
          恢復預設值
        </Button>
      </div>
      <p className="text-xs text-[var(--color-text-muted)]">{strategyRegistry[strategyId].description}</p>

      {strategyId === "ema-trend" && (
        <>
          <Field label="短期 EMA 週期" hint="短均線週期，需小於長均線週期">
            <TextInput type="number" min={2} value={num(params, "shortPeriod")} onChange={(e) => set("shortPeriod", Number(e.target.value))} />
          </Field>
          <Field label="長期 EMA 週期" hint="長均線週期">
            <TextInput type="number" min={3} value={num(params, "longPeriod")} onChange={(e) => set("longPeriod", Number(e.target.value))} />
          </Field>
          <Checkbox label="以收盤價突破作為確認" checked={bool(params, "confirmClose")} onChange={(e) => set("confirmClose", e.target.checked)} />
          <Checkbox label="以成交量放大作為確認" checked={bool(params, "confirmVolume")} onChange={(e) => set("confirmVolume", e.target.checked)} />
          <Checkbox label="以 RSI 方向作為確認" checked={bool(params, "confirmRsi")} onChange={(e) => set("confirmRsi", e.target.checked)} />
        </>
      )}

      {strategyId === "rsi-mean-reversion" && (
        <>
          <Field label="RSI 週期">
            <TextInput type="number" min={2} value={num(params, "period")} onChange={(e) => set("period", Number(e.target.value))} />
          </Field>
          <Field label="超賣門檻" hint="0~100，需小於超買門檻">
            <TextInput type="number" min={0} max={100} value={num(params, "oversold")} onChange={(e) => set("oversold", Number(e.target.value))} />
          </Field>
          <Field label="超買門檻" hint="0~100，需大於超賣門檻">
            <TextInput type="number" min={0} max={100} value={num(params, "overbought")} onChange={(e) => set("overbought", Number(e.target.value))} />
          </Field>
        </>
      )}

      {strategyId === "macd-trend" && (
        <>
          <Field label="快線週期">
            <TextInput type="number" min={2} value={num(params, "fastPeriod")} onChange={(e) => set("fastPeriod", Number(e.target.value))} />
          </Field>
          <Field label="慢線週期">
            <TextInput type="number" min={3} value={num(params, "slowPeriod")} onChange={(e) => set("slowPeriod", Number(e.target.value))} />
          </Field>
          <Field label="訊號線週期">
            <TextInput type="number" min={2} value={num(params, "signalPeriod")} onChange={(e) => set("signalPeriod", Number(e.target.value))} />
          </Field>
          <Checkbox label="要求零軸過濾" checked={bool(params, "useZeroAxisFilter")} onChange={(e) => set("useZeroAxisFilter", e.target.checked)} />
          <Checkbox label="要求成交量過濾" checked={bool(params, "useVolumeFilter")} onChange={(e) => set("useVolumeFilter", e.target.checked)} />
        </>
      )}

      {strategyId === "multi-factor" && (
        <MultiFactorForm params={params} onChange={onChange} />
      )}

      {errors.length > 0 && (
        <div className="rounded-md border border-[var(--color-down)]/40 bg-[var(--color-down-soft)]/40 p-2 text-xs text-[var(--color-down)]">
          <ul className="list-disc pl-4">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const FACTOR_KEYS: (keyof MultiFactorWeights)[] = ["emaTrend", "rsi", "macd", "volume", "bollinger", "volatility"];
const FACTOR_LABEL: Record<keyof MultiFactorWeights, string> = {
  emaTrend: "EMA 趨勢",
  rsi: "RSI",
  macd: "MACD",
  volume: "成交量",
  bollinger: "布林通道",
  volatility: "市場波動度",
};

function MultiFactorForm({ params, onChange }: { params: Params; onChange: (next: Params) => void }) {
  const weights = (params.weights as MultiFactorWeights) ?? multiFactorDefaultWeights;
  const weightSum = FACTOR_KEYS.reduce((a, k) => a + (weights[k] ?? 0), 0);

  const setWeight = (key: keyof MultiFactorWeights, value: number) => {
    onChange({ ...params, weights: { ...weights, [key]: value } });
  };

  return (
    <>
      <div className="rounded-md border border-[var(--color-border)] p-2">
        <p className="mb-2 flex items-center justify-between text-xs text-[var(--color-text-muted)]">
          <span>各因子權重（總和需為 100）</span>
          <span className={weightSum === 100 ? "text-[var(--color-up)]" : "text-[var(--color-down)]"}>目前總和：{weightSum.toFixed(1)}</span>
        </p>
        <div className="grid grid-cols-2 gap-2">
          {FACTOR_KEYS.map((key) => (
            <Field key={key} label={FACTOR_LABEL[key]}>
              <TextInput
                type="number"
                min={0}
                max={100}
                value={weights[key] ?? 0}
                onChange={(e) => setWeight(key, Number(e.target.value))}
              />
            </Field>
          ))}
        </div>
      </div>
      <Field label="訊號門檻" hint="總分達到 ±門檻才視為候選訊號，未達門檻視為觀望">
        <TextInput type="number" min={1} max={100} value={num(params, "scoreThreshold")} onChange={(e) => onChange({ ...params, scoreThreshold: Number(e.target.value) })} />
      </Field>
      <Field label="風險波動度倍數" hint="目前波動度超過中位數的此倍數時標示風險升高">
        <TextInput
          type="number"
          min={1.1}
          step={0.1}
          value={num(params, "riskVolatilityMultiple")}
          onChange={(e) => onChange({ ...params, riskVolatilityMultiple: Number(e.target.value) })}
        />
      </Field>
    </>
  );
}
