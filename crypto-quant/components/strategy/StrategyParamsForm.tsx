"use client";

import { Field, TextInput, Checkbox, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { strategyRegistry, type StrategyId } from "@/lib/strategies/registry";
import { multiFactorDefaultWeights, type MultiFactorWeights } from "@/lib/strategies/multiFactor";
import { useSymbols } from "@/lib/client/hooks";

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
  symbol,
  params,
  onChange,
  errors,
}: {
  strategyId: StrategyId;
  /** 使用者目前選擇的主要交易對，用於跨資產策略排除重複選到同一個交易對 */
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

      {strategyId === "smc" && (
        <>
          <Field label="擺動點確認根數" hint="判斷波段高低點時，左右各需要幾根 K 棒才確認，數值越大結構越重要但確認越慢">
            <TextInput type="number" min={2} max={50} value={num(params, "swingLookback")} onChange={(e) => set("swingLookback", Number(e.target.value))} />
          </Field>
          <Field label="訂單塊搜尋範圍" hint="往前搜尋造成突破的訂單塊（Order Block）候選 K 棒的根數">
            <TextInput type="number" min={1} max={100} value={num(params, "orderBlockLookback")} onChange={(e) => set("orderBlockLookback", Number(e.target.value))} />
          </Field>
          <Field label="突破動能倍數" hint="帶動突破的 K 棒實體須達到近期平均實體的幾倍，過濾不夠有力的假突破">
            <TextInput type="number" min={0.1} step={0.1} value={num(params, "minDisplacementMultiple")} onChange={(e) => set("minDisplacementMultiple", Number(e.target.value))} />
          </Field>
          <Field label="訂單塊有效期（根）" hint="訂單塊超過這麼多根 K 棒仍未被價格回測，視為失效不再觸發訊號">
            <TextInput type="number" min={1} max={500} value={num(params, "maxMitigationBars")} onChange={(e) => set("maxMitigationBars", Number(e.target.value))} />
          </Field>
        </>
      )}

      {strategyId === "smt" && <SmtForm symbol={symbol} params={params} onChange={onChange} />}

      {strategyId === "trend-pullback-ema" && (
        <>
          <Field label="短期 EMA 週期">
            <TextInput type="number" min={2} value={num(params, "emaShortPeriod")} onChange={(e) => set("emaShortPeriod", Number(e.target.value))} />
          </Field>
          <Field label="長期 EMA 週期">
            <TextInput type="number" min={3} value={num(params, "emaLongPeriod")} onChange={(e) => set("emaLongPeriod", Number(e.target.value))} />
          </Field>
          <Field label="回踩觸碰線" hint="以哪一條 EMA 作為回踩觸碰的參考線">
            <Select value={String(params.pullbackLine ?? "short")} onChange={(e) => set("pullbackLine", e.target.value)}>
              <option value="short">短期 EMA</option>
              <option value="long">長期 EMA</option>
            </Select>
          </Field>
          <Field label="訊號冷卻根數" hint="兩次訊號之間至少間隔幾根 K 棒，避免價格貼著 EMA 來回時連續觸發">
            <TextInput type="number" min={0} max={200} value={num(params, "cooldownBars")} onChange={(e) => set("cooldownBars", Number(e.target.value))} />
          </Field>
        </>
      )}

      {strategyId === "breakout-retest" && (
        <>
          <Field label="區間觀察根數" hint="判斷突破用的區間高低點，取過去這麼多根 K 棒（不含當根）">
            <TextInput type="number" min={2} max={500} value={num(params, "channelPeriod")} onChange={(e) => set("channelPeriod", Number(e.target.value))} />
          </Field>
          <Field label="回測容許距離（%）" hint="價格與突破關卡的最大相對距離，在此範圍內才算「回測到」">
            <TextInput type="number" min={0.1} step={0.1} max={10} value={num(params, "retestTolerancePct")} onChange={(e) => set("retestTolerancePct", Number(e.target.value))} />
          </Field>
          <Field label="關卡有效期（根）" hint="突破關卡超過這麼多根 K 棒仍未被回測，視為失效">
            <TextInput type="number" min={1} max={500} value={num(params, "maxRetestBars")} onChange={(e) => set("maxRetestBars", Number(e.target.value))} />
          </Field>
        </>
      )}

      {strategyId === "range-reversal" && (
        <>
          <Field label="區間觀察根數" hint="判斷支撐／壓力用的區間，取過去這麼多根 K 棒（不含當根）">
            <TextInput type="number" min={2} max={500} value={num(params, "rangePeriod")} onChange={(e) => set("rangePeriod", Number(e.target.value))} />
          </Field>
          <Field label="觸及容許距離（%）" hint="價格與支撐／壓力的最大相對距離，在此範圍內才算「觸及」">
            <TextInput type="number" min={0.1} step={0.1} max={10} value={num(params, "touchTolerancePct")} onChange={(e) => set("touchTolerancePct", Number(e.target.value))} />
          </Field>
        </>
      )}

      {strategyId === "bollinger-rsi-reversion" && (
        <>
          <Field label="布林通道週期">
            <TextInput type="number" min={2} value={num(params, "bollingerPeriod")} onChange={(e) => set("bollingerPeriod", Number(e.target.value))} />
          </Field>
          <Field label="布林通道標準差倍數">
            <TextInput type="number" min={0.1} step={0.1} value={num(params, "bollingerMultiplier")} onChange={(e) => set("bollingerMultiplier", Number(e.target.value))} />
          </Field>
          <Field label="RSI 週期">
            <TextInput type="number" min={2} value={num(params, "rsiPeriod")} onChange={(e) => set("rsiPeriod", Number(e.target.value))} />
          </Field>
          <Field label="超賣門檻">
            <TextInput type="number" min={0} max={100} value={num(params, "oversold")} onChange={(e) => set("oversold", Number(e.target.value))} />
          </Field>
          <Field label="超買門檻">
            <TextInput type="number" min={0} max={100} value={num(params, "overbought")} onChange={(e) => set("overbought", Number(e.target.value))} />
          </Field>
        </>
      )}

      {strategyId === "rsi-divergence-structure" && (
        <>
          <Field label="RSI 週期">
            <TextInput type="number" min={2} value={num(params, "rsiPeriod")} onChange={(e) => set("rsiPeriod", Number(e.target.value))} />
          </Field>
          <Field label="擺動點確認根數">
            <TextInput type="number" min={2} max={50} value={num(params, "swingLookback")} onChange={(e) => set("swingLookback", Number(e.target.value))} />
          </Field>
          <Field label="結構確認有效期（根）" hint="背離出現後，必須在幾根 K 棒之內完成結構確認，否則視為失效">
            <TextInput type="number" min={1} max={500} value={num(params, "maxConfirmBars")} onChange={(e) => set("maxConfirmBars", Number(e.target.value))} />
          </Field>
        </>
      )}

      {strategyId === "vwap-pullback" && (
        <>
          <Field label="偏向確認根數" hint="至少連續幾根收盤在 VWAP 同一側，才視為當日偏向已經成立">
            <TextInput type="number" min={1} max={200} value={num(params, "minBiasBars")} onChange={(e) => set("minBiasBars", Number(e.target.value))} />
          </Field>
          <Field label="訊號冷卻根數">
            <TextInput type="number" min={0} max={200} value={num(params, "cooldownBars")} onChange={(e) => set("cooldownBars", Number(e.target.value))} />
          </Field>
        </>
      )}

      {strategyId === "false-breakout-reclaim" && (
        <>
          <Field label="支撐／壓力觀察根數">
            <TextInput type="number" min={2} max={500} value={num(params, "lookbackPeriod")} onChange={(e) => set("lookbackPeriod", Number(e.target.value))} />
          </Field>
          <Field label="收回確認根數" hint="跌破／突破後，必須在幾根 K 棒之內收盤收回，否則視為真突破">
            <TextInput type="number" min={1} max={50} value={num(params, "maxReclaimBars")} onChange={(e) => set("maxReclaimBars", Number(e.target.value))} />
          </Field>
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

function SmtForm({ symbol, params, onChange }: { symbol: string; params: Params; onChange: (next: Params) => void }) {
  const { data: symbolsData } = useSymbols();
  const correlatedSymbol = typeof params.correlatedSymbol === "string" ? params.correlatedSymbol : "";
  const sameAsSymbol = correlatedSymbol !== "" && correlatedSymbol === symbol;

  return (
    <>
      <div className="rounded-md border border-[var(--color-warn)]/30 bg-[var(--color-warn)]/5 p-2 text-xs text-[var(--color-text-muted)]">
        SMT 背離策略需要同時讀取「主要交易對」與「比較交易對」兩組 K 線，僅在策略設定頁執行回測時會抓取比較交易對資料；行情頁的即時圖表預覽不會顯示此策略的訊號標記。
      </div>
      <Field label="比較交易對" hint="用來檢查是否同步創高/創低的另一個交易對，須與主要交易對不同">
        <Select value={correlatedSymbol} onChange={(e) => onChange({ ...params, correlatedSymbol: e.target.value })}>
          {(symbolsData?.symbols ?? []).map((s) => (
            <option key={s.symbol} value={s.symbol} disabled={s.symbol === symbol}>
              {s.displayName}
              {s.symbol === symbol ? "（與主要交易對相同，不可選）" : ""}
            </option>
          ))}
        </Select>
      </Field>
      {sameAsSymbol && <p className="text-xs text-[var(--color-down)]">比較交易對不可與主要交易對相同，請重新選擇。</p>}
      <Field label="擺動點確認根數" hint="判斷波段高低點時，左右各需要幾根 K 棒才確認">
        <TextInput type="number" min={2} max={50} value={num(params, "swingLookback")} onChange={(e) => onChange({ ...params, swingLookback: Number(e.target.value) })} />
      </Field>
      <Field label="擺動點同步容許根數" hint="兩個交易對的擺動點時間差在幾根 K 棒之內才視為同步可比較">
        <TextInput type="number" min={0} max={50} value={num(params, "maxMatchBars")} onChange={(e) => onChange({ ...params, maxMatchBars: Number(e.target.value) })} />
      </Field>
    </>
  );
}
