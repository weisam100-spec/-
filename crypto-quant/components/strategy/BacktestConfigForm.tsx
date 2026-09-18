"use client";

import { Field, TextInput, Checkbox } from "@/components/ui/Field";
import type { BacktestConfig } from "@/lib/backtest/types";

function toDateInputValue(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
function fromDateInputValue(value: string, endOfDay = false): number {
  return new Date(`${value}T${endOfDay ? "23:59:59" : "00:00:00"}+08:00`).getTime();
}

export function BacktestConfigForm({
  config,
  onChange,
}: {
  config: BacktestConfig;
  onChange: (next: BacktestConfig) => void;
}) {
  const set = <K extends keyof BacktestConfig>(key: K, value: BacktestConfig[K]) => onChange({ ...config, [key]: value });

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-[var(--color-text)]">回測參數</p>

      <div className="grid grid-cols-2 gap-2">
        <Field label="開始日期（台北時間）">
          <TextInput type="date" value={toDateInputValue(config.startTime)} onChange={(e) => set("startTime", fromDateInputValue(e.target.value))} />
        </Field>
        <Field label="結束日期（台北時間）">
          <TextInput type="date" value={toDateInputValue(config.endTime)} onChange={(e) => set("endTime", fromDateInputValue(e.target.value, true))} />
        </Field>
      </div>

      <Field label="初始資金（USDT）">
        <TextInput type="number" min={1} value={config.initialCapitalUsdt} onChange={(e) => set("initialCapitalUsdt", Number(e.target.value))} />
      </Field>
      <Field label="每次投入比例（%）" hint="佔目前可用資金的比例，最高 100%">
        <TextInput type="number" min={1} max={100} value={config.positionSizePct} onChange={(e) => set("positionSizePct", Number(e.target.value))} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="手續費率（%）">
          <TextInput type="number" min={0} max={5} step={0.01} value={config.feeRatePct} onChange={(e) => set("feeRatePct", Number(e.target.value))} />
        </Field>
        <Field label="滑價（%）">
          <TextInput type="number" min={0} max={5} step={0.01} value={config.slippageRatePct} onChange={(e) => set("slippageRatePct", Number(e.target.value))} />
        </Field>
      </div>

      <OptionalPercentField
        label="停損比例（%）"
        value={config.stopLossPct}
        onChange={(v) => set("stopLossPct", v)}
      />
      <OptionalPercentField
        label="停利比例（%）"
        value={config.takeProfitPct}
        onChange={(v) => set("takeProfitPct", v)}
      />
      <OptionalPercentField
        label="移動停損比例（%）"
        value={config.trailingStopPct}
        onChange={(v) => set("trailingStopPct", v)}
      />

      <div className="rounded-md border border-[var(--color-border)] p-2 text-xs text-[var(--color-text-muted)]">
        第一版僅支援現貨多頭單一持倉模擬回測（最大同時持倉數固定為 1），尚未支援槓桿、合約、資金費率與強制平倉。
      </div>
    </div>
  );
}

function OptionalPercentField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const enabled = value !== null;
  return (
    <div className="flex items-center gap-2">
      <Checkbox label={label} checked={enabled} onChange={(e) => onChange(e.target.checked ? 5 : null)} />
      {enabled && (
        <TextInput
          type="number"
          min={0.1}
          max={99}
          step={0.1}
          className="w-24"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      )}
    </div>
  );
}
