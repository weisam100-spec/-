"use client";

import { Field, TextInput, Checkbox, Select } from "@/components/ui/Field";
import type { BacktestConfig, RiskBasedSizingConfig, SplitTakeProfitConfig } from "@/lib/backtest/types";

const DEFAULT_SPLIT_TP: SplitTakeProfitConfig = { tp1Pct: 3, tp1SizePct: 50, tp2Pct: 8 };
const DEFAULT_RISK_SIZING: RiskBasedSizingConfig = { riskPct: 1 };

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

      <Field
        label="交易方向"
        hint={
          config.direction === "long_short"
            ? "模擬放空：假設用保證金／合約放空，偏空候選訊號會真的開空單計算損益。這是簡化的數學模擬，並未模擬借貸成本、資金費率與強制平倉；現貨本身無法放空，本站任何模式都不會真的執行下單。"
            : "僅做多，對應現貨實際能做到的事"
        }
      >
        <Select
          value={config.direction}
          onChange={(e) => set("direction", e.target.value as BacktestConfig["direction"])}
        >
          <option value="long_only">僅做多（現貨，預設）</option>
          <option value="long_short">可做多做空（模擬保證金／合約）</option>
        </Select>
      </Field>

      <Field label="初始資金（USDT）">
        <TextInput type="number" min={1} value={config.initialCapitalUsdt} onChange={(e) => set("initialCapitalUsdt", Number(e.target.value))} />
      </Field>
      {config.riskBasedSizing === null && (
        <Field label="每次投入比例（%）" hint="佔目前可用資金的比例，最高 100%">
          <TextInput type="number" min={1} max={100} value={config.positionSizePct} onChange={(e) => set("positionSizePct", Number(e.target.value))} />
        </Field>
      )}
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

      <div className="flex flex-col gap-2 rounded-md border border-[var(--color-border)] p-2">
        <Checkbox
          label="固定風險比例部位（1R）"
          checked={config.riskBasedSizing !== null}
          onChange={(e) =>
            onChange({
              ...config,
              riskBasedSizing: e.target.checked ? DEFAULT_RISK_SIZING : null,
              stopLossPct: e.target.checked && config.stopLossPct === null ? 5 : config.stopLossPct,
            })
          }
        />
        {config.riskBasedSizing !== null && (
          <>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              每筆交易最多願意賠掉目前可用資金的這個比例（即「1R」），系統會依照停損比例自動反推該用多少部位，取代上方「每次投入比例」。必須設定停損比例才能使用；現貨不開槓桿，若反推出的部位金額超過可用資金，會被限制在可用資金以內，此時實際風險會低於設定值。
            </p>
            <Field label="每筆交易風險比例（%）" hint="佔目前可用資金的比例，常見設定為 0.5% ~ 2%">
              <TextInput
                type="number"
                min={0.1}
                max={100}
                step={0.1}
                value={config.riskBasedSizing.riskPct}
                onChange={(e) => set("riskBasedSizing", { riskPct: Number(e.target.value) })}
              />
            </Field>
            {config.stopLossPct === null && (
              <p className="text-xs text-[var(--color-down)]">尚未設定停損比例，請勾選上方「停損比例」並填入數值，否則回測會失敗。</p>
            )}
          </>
        )}
      </div>

      {config.splitTakeProfit === null && (
        <OptionalPercentField
          label="停利比例（%）"
          value={config.takeProfitPct}
          onChange={(v) => set("takeProfitPct", v)}
        />
      )}

      <div className="flex flex-col gap-2 rounded-md border border-[var(--color-border)] p-2">
        <Checkbox
          label="分批停利（TP1 / TP2）"
          checked={config.splitTakeProfit !== null}
          onChange={(e) =>
            onChange({
              ...config,
              splitTakeProfit: e.target.checked ? DEFAULT_SPLIT_TP : null,
              takeProfitPct: e.target.checked ? null : config.takeProfitPct,
            })
          }
        />
        {config.splitTakeProfit !== null && (
          <>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              價格先漲到 TP1 時先出一部分部位鎖住獲利，剩餘部位繼續持有到 TP2
              或觸發停損／移動停損／策略出場訊號才出清。啟用後會停用上方的單一停利比例。
            </p>
            <div className="grid grid-cols-3 gap-2">
              <Field label="TP1 漲幅（%）">
                <TextInput
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={config.splitTakeProfit.tp1Pct}
                  onChange={(e) =>
                    set("splitTakeProfit", { ...config.splitTakeProfit!, tp1Pct: Number(e.target.value) })
                  }
                />
              </Field>
              <Field label="TP1 出場比例（%）">
                <TextInput
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  value={config.splitTakeProfit.tp1SizePct}
                  onChange={(e) =>
                    set("splitTakeProfit", { ...config.splitTakeProfit!, tp1SizePct: Number(e.target.value) })
                  }
                />
              </Field>
              <Field label="TP2 漲幅（%）">
                <TextInput
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={config.splitTakeProfit.tp2Pct}
                  onChange={(e) =>
                    set("splitTakeProfit", { ...config.splitTakeProfit!, tp2Pct: Number(e.target.value) })
                  }
                />
              </Field>
            </div>
          </>
        )}
      </div>

      <OptionalPercentField
        label="移動停損比例（%）"
        value={config.trailingStopPct}
        onChange={(v) => set("trailingStopPct", v)}
      />

      <div className="rounded-md border border-[var(--color-border)] p-2 text-xs text-[var(--color-text-muted)]">
        第一版僅支援單一持倉模擬回測（最大同時持倉數固定為 1）；「可做多做空」只是簡化的損益模擬，不會真的執行下單，也未模擬真實槓桿／合約交易的借貸成本、資金費率與強制平倉機制。
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
