"use client";

import { METRIC_EXPLANATIONS, type PerformanceMetrics } from "@/lib/backtest/metrics";
import { formatDuration, formatPercent, formatUsdt, signClass } from "@/lib/format";

interface MetricDef {
  key: keyof PerformanceMetrics;
  label: string;
  format: (m: PerformanceMetrics) => string;
  colorize?: boolean;
}

const METRICS: MetricDef[] = [
  { key: "finalEquity", label: "期末資產", format: (m) => formatUsdt(m.finalEquity) },
  { key: "totalReturnPct", label: "總報酬率", format: (m) => formatPercent(m.totalReturnPct), colorize: true },
  { key: "cagrPct", label: "年化報酬率", format: (m) => (m.cagrPct === null ? "資料不足" : formatPercent(m.cagrPct)), colorize: true },
  { key: "buyHoldReturnPct", label: "買進持有報酬率", format: (m) => formatPercent(m.buyHoldReturnPct), colorize: true },
  { key: "excessReturnPct", label: "超額報酬", format: (m) => formatPercent(m.excessReturnPct), colorize: true },
  { key: "maxDrawdownPct", label: "最大回撤", format: (m) => `${m.maxDrawdownPct.toFixed(2)}%` },
  { key: "annualizedVolatilityPct", label: "年化波動率", format: (m) => (m.annualizedVolatilityPct === null ? "資料不足" : `${m.annualizedVolatilityPct.toFixed(2)}%`) },
  { key: "sharpeRatio", label: "Sharpe Ratio", format: (m) => (m.sharpeRatio === null ? "資料不足" : m.sharpeRatio.toFixed(2)) },
  { key: "sortinoRatio", label: "Sortino Ratio", format: (m) => (m.sortinoRatio === null ? "資料不足" : m.sortinoRatio.toFixed(2)) },
  { key: "calmarRatio", label: "Calmar Ratio", format: (m) => (m.calmarRatio === null ? "資料不足" : m.calmarRatio.toFixed(2)) },
  { key: "winRatePct", label: "勝率", format: (m) => (m.winRatePct === null ? "無交易" : `${m.winRatePct.toFixed(1)}%`) },
  { key: "profitFactor", label: "獲利因子", format: (m) => (m.profitFactor === null ? "無交易" : m.profitFactor === Infinity ? "∞（無虧損交易）" : m.profitFactor.toFixed(2)) },
  { key: "avgWin", label: "平均獲利", format: (m) => (m.avgWin === null ? "無獲利交易" : formatUsdt(m.avgWin)) },
  { key: "avgLoss", label: "平均虧損", format: (m) => (m.avgLoss === null ? "無虧損交易" : formatUsdt(-m.avgLoss)) },
  { key: "profitLossRatio", label: "盈虧比", format: (m) => (m.profitLossRatio === null ? "資料不足" : m.profitLossRatio.toFixed(2)) },
  { key: "tradeCount", label: "交易次數", format: (m) => `${m.tradeCount} 筆` },
  { key: "avgHoldingMs", label: "平均持倉時間", format: (m) => (m.avgHoldingMs === null ? "無交易" : formatDuration(m.avgHoldingMs)) },
  { key: "maxConsecutiveWins", label: "最大連續獲利次數", format: (m) => `${m.maxConsecutiveWins} 次` },
  { key: "maxConsecutiveLosses", label: "最大連續虧損次數", format: (m) => `${m.maxConsecutiveLosses} 次` },
  { key: "grossReturnBeforeCostPct", label: "扣成本前報酬率", format: (m) => formatPercent(m.grossReturnBeforeCostPct), colorize: true },
  { key: "netReturnAfterCostPct", label: "扣成本後報酬率", format: (m) => formatPercent(m.netReturnAfterCostPct), colorize: true },
  { key: "costDragPct", label: "成本拖累幅度", format: (m) => `${m.costDragPct.toFixed(2)}%` },
  { key: "totalCostUsdt", label: "累計交易成本", format: (m) => formatUsdt(m.totalCostUsdt) },
];

export function MetricsGrid({ metrics }: { metrics: PerformanceMetrics }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {METRICS.map((def) => {
        const raw = metrics[def.key];
        const numeric = typeof raw === "number" ? raw : null;
        return (
          <div key={def.key} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-2.5" title={METRIC_EXPLANATIONS[def.key]}>
            <p className="text-[11px] text-[var(--color-text-muted)]">{def.label}</p>
            <p className={`mt-0.5 text-sm font-semibold ${def.colorize && numeric !== null ? signClass(numeric) : "text-[var(--color-text)]"}`}>
              {def.format(metrics)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
