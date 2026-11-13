"use client";

import { Field, TextInput, Checkbox } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { strategyRegistry, type StrategyId } from "@/lib/strategies/registry";

type Params = Record<string, unknown>;

function num(params: Params, key: string): number {
  const v = params[key];
  return typeof v === "number" ? v : Number(v ?? 0);
}

export function StrategyParamsForm({
  strategyId,
  params,
  onChange,
  errors,
}: {
  strategyId: StrategyId;
  /** 使用者目前選擇的主要交易對，保留供未來跨資產策略使用 */
  symbol: string;
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

      {strategyId === "fvg-supply-demand" && (
        <>
          <div className="rounded-md border border-[var(--color-warn)]/30 bg-[var(--color-warn)]/5 p-2 text-xs text-[var(--color-text-muted)]">
            供需區與價格失衡區（FVG）須在彼此「雙重確認容許根數」之內同時被價格回測／回補，才會形成候選訊號；兩個概念皆為公開定義的技術分析方法，純屬歷史價格結構分析，不是預測。
          </div>
          <Field label="擺動點確認根數" hint="判斷波段高低點時，左右各需要幾根 K 棒才確認，數值越大結構越重要但確認越慢">
            <TextInput type="number" min={2} max={50} value={num(params, "swingLookback")} onChange={(e) => set("swingLookback", Number(e.target.value))} />
          </Field>
          <Field label="供需區搜尋範圍" hint="往前搜尋造成突破的供需區（訂單塊）候選 K 棒的根數">
            <TextInput type="number" min={1} max={100} value={num(params, "orderBlockLookback")} onChange={(e) => set("orderBlockLookback", Number(e.target.value))} />
          </Field>
          <Field label="突破動能倍數" hint="帶動突破的 K 棒實體須達到近期平均實體的幾倍，過濾不夠有力的假突破">
            <TextInput type="number" min={0.1} step={0.1} value={num(params, "minDisplacementMultiple")} onChange={(e) => set("minDisplacementMultiple", Number(e.target.value))} />
          </Field>
          <Field label="供需區有效期（根）" hint="供需區超過這麼多根 K 棒仍未被價格回測，視為失效">
            <TextInput type="number" min={1} max={500} value={num(params, "maxMitigationBars")} onChange={(e) => set("maxMitigationBars", Number(e.target.value))} />
          </Field>
          <Field label="FVG 最小缺口比例（%）" hint="缺口大小需達到缺口中點價格的這個百分比以上，過濾雜訊">
            <TextInput type="number" min={0} max={10} step={0.01} value={num(params, "minGapPct")} onChange={(e) => set("minGapPct", Number(e.target.value))} />
          </Field>
          <Field label="FVG 有效期（根）" hint="缺口超過這麼多根 K 棒仍未被回補，視為失效">
            <TextInput type="number" min={1} max={500} value={num(params, "maxFvgAgeBars")} onChange={(e) => set("maxFvgAgeBars", Number(e.target.value))} />
          </Field>
          <Field label="雙重確認容許根數" hint="供需區回測與 FVG 回補須在彼此這麼多根 K 棒之內發生，才視為雙重確認">
            <TextInput type="number" min={0} max={100} value={num(params, "confirmWindowBars")} onChange={(e) => set("confirmWindowBars", Number(e.target.value))} />
          </Field>
          <Checkbox
            label="多時間框架順勢過濾"
            checked={Boolean(params.useHigherTimeframeFilter)}
            onChange={(e) => set("useHigherTimeframeFilter", e.target.checked)}
          />
          {Boolean(params.useHigherTimeframeFilter) && (
            <p className="text-[11px] text-[var(--color-text-muted)]">
              啟用後，只有當高一層時間週期（5分鐘→1小時、15分鐘→4小時、1小時→4小時、4小時→日線）當下的市場結構方向與訊號方向一致時，才會保留該訊號，藉此過濾掉逆著大趨勢的雜訊；代價是訊號會變得更稀少。日線本身已是最高週期，此開關對日線無效果。
            </p>
          )}
        </>
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
