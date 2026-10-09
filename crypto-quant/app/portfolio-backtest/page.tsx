"use client";

import { useState } from "react";
import { RiskBanner } from "@/components/common/RiskBanner";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Select, TextInput, Checkbox } from "@/components/ui/Field";
import { ErrorState, LoadingState } from "@/components/common/StatusStates";
import { EquityCurveChart } from "@/components/charts/EquityCurveChart";
import { useRunPortfolioBacktest, useSymbols } from "@/lib/client/hooks";
import { strategyRegistry, requiresCorrelatedAsset, type StrategyId } from "@/lib/strategies/registry";
import { SUPPORTED_INTERVALS, INTERVAL_LABEL, type Interval } from "@/lib/market/symbols";
import { formatPercent } from "@/lib/format";

const OPTIMIZABLE_STRATEGY_IDS = (Object.keys(strategyRegistry) as StrategyId[]).filter((id) => !requiresCorrelatedAsset(id));
const MAX_LEGS = 6;

interface LegDraft {
  key: string;
  label: string;
  symbol: string;
  interval: Interval;
  strategyId: StrategyId;
  capitalUsdt: number;
}

let legKeySeq = 0;
function newLeg(label: string, symbol: string, strategyId: StrategyId): LegDraft {
  legKeySeq += 1;
  return { key: `leg-${legKeySeq}`, label, symbol, interval: "1h", strategyId, capitalUsdt: 50000 };
}

function toDateInputValue(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
function fromDateInputValue(value: string, endOfDay = false): number {
  return new Date(`${value}T${endOfDay ? "23:59:59" : "00:00:00"}+08:00`).getTime();
}

export default function PortfolioBacktestPage() {
  const { data: symbolsData } = useSymbols();
  const [legs, setLegs] = useState<LegDraft[]>([
    newLeg("成分一：BTC EMA 趨勢", "BTCUSDT", "ema-trend"),
    newLeg("成分二：ETH RSI 均值回歸", "ETHUSDT", "rsi-mean-reversion"),
  ]);
  const [startTime, setStartTime] = useState(Date.now() - 180 * 24 * 60 * 60 * 1000);
  const [endTime, setEndTime] = useState(Date.now());
  const [feeRatePct, setFeeRatePct] = useState(0.1);
  const [slippageRatePct, setSlippageRatePct] = useState(0.05);
  const [positionSizePct, setPositionSizePct] = useState(100);
  const [stopLossPct, setStopLossPct] = useState<number | null>(null);
  const [takeProfitPct, setTakeProfitPct] = useState<number | null>(null);

  const mutation = useRunPortfolioBacktest();

  const updateLeg = (key: string, patch: Partial<LegDraft>) =>
    setLegs((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const removeLeg = (key: string) => setLegs((prev) => prev.filter((l) => l.key !== key));
  const addLeg = () => {
    if (legs.length >= MAX_LEGS) return;
    setLegs((prev) => [...prev, newLeg(`成分${prev.length + 1}`, "BTCUSDT", "ema-trend")]);
  };

  const totalCapital = legs.reduce((a, l) => a + (Number.isFinite(l.capitalUsdt) ? l.capitalUsdt : 0), 0);

  const handleRun = () => {
    if (legs.length === 0) return;
    mutation.mutate({
      startTime,
      endTime,
      feeRatePct,
      slippageRatePct,
      positionSizePct,
      stopLossPct,
      takeProfitPct,
      trailingStopPct: null,
      legs: legs.map((l) => ({
        label: l.label,
        symbol: l.symbol,
        interval: l.interval,
        strategyId: l.strategyId,
        strategyParams: strategyRegistry[l.strategyId].defaultParams,
        capitalUsdt: l.capitalUsdt,
      })),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <RiskBanner />
      <h1 className="text-lg font-bold text-[var(--color-text)]">多策略組合回測</h1>
      <p className="text-sm text-[var(--color-text-muted)]">
        把多個「策略＋交易對」成分各自分配一筆獨立資金分開模擬，再以日曆日對齊加總成資產曲線，觀察組合整體的報酬、回撤與各成分之間的相關性。這是把各成分「各自獨立模擬」後加總，並非真正共用資金池、再平衡或槓桿／保證金管理，僅供分散配置的研究參考，不構成投資建議。跨資產策略（SMT）需要額外選擇比較交易對，目前尚不支援加入組合回測。
      </p>

      <Card>
        <CardHeader>
          <CardTitle>共同條件</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="開始日期（台北時間）">
            <TextInput type="date" value={toDateInputValue(startTime)} onChange={(e) => setStartTime(fromDateInputValue(e.target.value))} />
          </Field>
          <Field label="結束日期（台北時間）">
            <TextInput type="date" value={toDateInputValue(endTime)} onChange={(e) => setEndTime(fromDateInputValue(e.target.value, true))} />
          </Field>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="每次投入比例（%）" hint="各成分皆適用，佔該成分可用資金的比例">
            <TextInput type="number" min={1} max={100} value={positionSizePct} onChange={(e) => setPositionSizePct(Number(e.target.value))} />
          </Field>
          <Field label="手續費率（%）">
            <TextInput type="number" min={0} max={5} step={0.01} value={feeRatePct} onChange={(e) => setFeeRatePct(Number(e.target.value))} />
          </Field>
          <Field label="滑價（%）">
            <TextInput type="number" min={0} max={5} step={0.01} value={slippageRatePct} onChange={(e) => setSlippageRatePct(Number(e.target.value))} />
          </Field>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <Checkbox label="停損比例（%）" checked={stopLossPct !== null} onChange={(e) => setStopLossPct(e.target.checked ? 5 : null)} />
            {stopLossPct !== null && (
              <TextInput type="number" min={0.1} max={99} step={0.1} className="w-24" value={stopLossPct} onChange={(e) => setStopLossPct(Number(e.target.value))} />
            )}
          </div>
          <div className="flex items-center gap-2">
            <Checkbox label="停利比例（%）" checked={takeProfitPct !== null} onChange={(e) => setTakeProfitPct(e.target.checked ? 10 : null)} />
            {takeProfitPct !== null && (
              <TextInput type="number" min={0.1} step={0.1} className="w-24" value={takeProfitPct} onChange={(e) => setTakeProfitPct(Number(e.target.value))} />
            )}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>組合成分（共 {legs.length} 個，總資金 {totalCapital.toLocaleString("zh-TW")} USDT）</CardTitle>
          <Button variant="secondary" className="!px-2 !py-1" onClick={addLeg} disabled={legs.length >= MAX_LEGS}>
            新增成分
          </Button>
        </CardHeader>
        <div className="flex flex-col gap-3">
          {legs.map((leg) => (
            <div key={leg.key} className="grid grid-cols-1 gap-2 rounded-md border border-[var(--color-border)] p-2 sm:grid-cols-6">
              <TextInput value={leg.label} onChange={(e) => updateLeg(leg.key, { label: e.target.value })} className="sm:col-span-2" placeholder="成分名稱" />
              <Select value={leg.symbol} onChange={(e) => updateLeg(leg.key, { symbol: e.target.value })}>
                {(symbolsData?.symbols ?? []).map((s) => (
                  <option key={s.symbol} value={s.symbol}>
                    {s.displayName}
                  </option>
                ))}
              </Select>
              <Select value={leg.interval} onChange={(e) => updateLeg(leg.key, { interval: e.target.value as Interval })}>
                {SUPPORTED_INTERVALS.map((iv) => (
                  <option key={iv} value={iv}>
                    {INTERVAL_LABEL[iv]}
                  </option>
                ))}
              </Select>
              <Select value={leg.strategyId} onChange={(e) => updateLeg(leg.key, { strategyId: e.target.value as StrategyId })}>
                {OPTIMIZABLE_STRATEGY_IDS.map((id) => (
                  <option key={id} value={id}>
                    {strategyRegistry[id].name}
                  </option>
                ))}
              </Select>
              <div className="flex items-center gap-1">
                <TextInput
                  type="number"
                  min={1}
                  value={leg.capitalUsdt}
                  onChange={(e) => updateLeg(leg.key, { capitalUsdt: Number(e.target.value) })}
                  className="flex-1"
                  placeholder="分配資金 USDT"
                />
                <Button variant="ghost" className="!px-2 !py-1 text-[var(--color-down)]" onClick={() => removeLeg(leg.key)} disabled={legs.length <= 1}>
                  移除
                </Button>
              </div>
            </div>
          ))}
          <p className="text-xs text-[var(--color-text-muted)]">各成分皆使用該策略的預設參數；如需自訂參數，請先在「策略設定」頁個別測試後再決定要納入組合的設定。</p>
        </div>
        <Button className="mt-3" onClick={handleRun} disabled={mutation.isPending || legs.length === 0}>
          {mutation.isPending ? "組合回測執行中…" : "執行組合回測"}
        </Button>
      </Card>

      {mutation.isPending && <LoadingState label="正在個別回測各組合成分並加總結果…" />}
      {mutation.isError && <ErrorState message={mutation.error instanceof Error ? mutation.error.message : "組合回測執行失敗"} />}

      {mutation.data && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>組合整體績效</CardTitle>
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="總報酬率" value={formatPercent(mutation.data.combinedMetrics.totalReturnPct)} positive={mutation.data.combinedMetrics.totalReturnPct >= 0} />
              <Stat label="買進持有報酬率" value={formatPercent(mutation.data.combinedMetrics.buyHoldReturnPct)} positive={mutation.data.combinedMetrics.buyHoldReturnPct >= 0} />
              <Stat label="最大回撤" value={`${mutation.data.combinedMetrics.maxDrawdownPct.toFixed(2)}%`} />
              <Stat label="年化報酬率" value={mutation.data.combinedMetrics.cagrPct === null ? "—" : formatPercent(mutation.data.combinedMetrics.cagrPct)} positive={(mutation.data.combinedMetrics.cagrPct ?? 0) >= 0} />
              <Stat label="年化波動度" value={mutation.data.combinedMetrics.annualizedVolatilityPct === null ? "—" : `${mutation.data.combinedMetrics.annualizedVolatilityPct.toFixed(2)}%`} />
              <Stat label="Sharpe Ratio" value={mutation.data.combinedMetrics.sharpeRatio?.toFixed(2) ?? "—"} />
              <Stat label="總資金" value={`${mutation.data.combinedMetrics.initialCapital.toLocaleString("zh-TW")} USDT`} />
              <Stat label="期末資產" value={`${mutation.data.combinedMetrics.finalEquity.toLocaleString("zh-TW", { maximumFractionDigits: 0 })} USDT`} />
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>組合資金曲線（組合 vs. 全部買進持有）</CardTitle>
            </CardHeader>
            <EquityCurveChart data={mutation.data.combinedEquityCurve} />
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>各成分績效</CardTitle>
            </CardHeader>
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full min-w-[640px] text-xs">
                <thead className="text-[var(--color-text-muted)]">
                  <tr>
                    <th className="p-2 text-left">成分</th>
                    <th className="p-2 text-right">分配資金</th>
                    <th className="p-2 text-right">總報酬率</th>
                    <th className="p-2 text-right">最大回撤</th>
                    <th className="p-2 text-right">Sharpe</th>
                    <th className="p-2 text-right">交易次數</th>
                  </tr>
                </thead>
                <tbody>
                  {mutation.data.legs.map((l, i) => (
                    <tr key={i} className="border-t border-[var(--color-border)]">
                      <td className="p-2 font-medium text-[var(--color-text)]">
                        {l.label}
                        <span className="ml-1 text-[var(--color-text-muted)]">
                          ({l.symbol} · {strategyRegistry[l.strategyId].name})
                        </span>
                      </td>
                      {l.ok && l.metrics ? (
                        <>
                          <td className="p-2 text-right">{l.capitalUsdt.toLocaleString("zh-TW")}</td>
                          <td className={`p-2 text-right ${l.metrics.totalReturnPct >= 0 ? "pos" : "neg"}`}>{formatPercent(l.metrics.totalReturnPct)}</td>
                          <td className="p-2 text-right">{l.metrics.maxDrawdownPct.toFixed(2)}%</td>
                          <td className="p-2 text-right">{l.metrics.sharpeRatio?.toFixed(2) ?? "—"}</td>
                          <td className="p-2 text-right">{l.metrics.tradeCount}</td>
                        </>
                      ) : (
                        <td colSpan={5} className="p-2 text-[var(--color-down)]">
                          {l.error ?? "執行失敗"}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>成分間相關係數</CardTitle>
            </CardHeader>
            <p className="mb-2 text-xs text-[var(--color-text-muted)]">
              以每日報酬率計算的皮爾森相關係數，範圍 -1 ~ 1；數值越接近 0 或負值，代表兩個成分走勢越不同步，分散配置的效果越明顯。資料天數過少時會顯示「—」。
            </p>
            {mutation.data.correlations.length === 0 ? (
              <p className="text-xs text-[var(--color-text-muted)]">只有一個成分，無法計算相關係數</p>
            ) : (
              <ul className="flex flex-col gap-1 text-xs">
                {mutation.data.correlations.map((c, i) => (
                  <li key={i} className="flex items-center justify-between rounded-md border border-[var(--color-border)] px-2 py-1">
                    <span>
                      {c.legA} vs {c.legB}
                    </span>
                    <span className="font-medium text-[var(--color-text)]">{c.correlation === null ? "—" : c.correlation.toFixed(3)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="rounded-md border border-[var(--color-border)] p-2">
      <p className="text-[11px] text-[var(--color-text-muted)]">{label}</p>
      <p className={`text-sm font-semibold ${positive === undefined ? "text-[var(--color-text)]" : positive ? "pos" : "neg"}`}>{value}</p>
    </div>
  );
}
