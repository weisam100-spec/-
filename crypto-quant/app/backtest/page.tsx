"use client";

import Link from "next/link";
import { RiskBanner } from "@/components/common/RiskBanner";
import { DataSourceBadge } from "@/components/common/DataSourceBadge";
import { EmptyState } from "@/components/common/StatusStates";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { MetricsGrid } from "@/components/backtest/MetricsGrid";
import { TradesTable } from "@/components/backtest/TradesTable";
import { EquityCurveChart } from "@/components/charts/EquityCurveChart";
import { DrawdownChart } from "@/components/charts/DrawdownChart";
import { MonthlyReturnHeatmap } from "@/components/charts/MonthlyReturnHeatmap";
import { TradePnlHistogram } from "@/components/charts/TradePnlHistogram";
import { SensitivityPanel } from "@/components/backtest/SensitivityPanel";
import { WalkForwardPanel } from "@/components/backtest/WalkForwardPanel";
import { useResultStore } from "@/lib/client/resultStore";
import { formatDateTime } from "@/lib/format";
import { INTERVAL_LABEL } from "@/lib/market/symbols";

export default function BacktestResultPage() {
  const run = useResultStore((s) => s.lastBacktest);

  if (!run) {
    return (
      <div className="flex flex-col gap-4">
        <RiskBanner />
        <Card>
          <EmptyState message="尚未有回測結果" hint="請先前往「策略設定頁」設定參數並執行回測" />
          <div className="mt-3 text-center">
            <Link href="/strategy" className="text-sm text-[var(--color-accent)] hover:underline">
              前往策略設定頁 →
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const { response } = run;

  return (
    <div className="flex flex-col gap-4">
      <RiskBanner />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>
              {run.symbol} · {INTERVAL_LABEL[run.interval]} · {run.strategyName}
            </CardTitle>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              執行於 {formatDateTime(run.runAt)} · 使用 {response.usedCandles} 根 K 棒 · 產生 {response.signalCount} 個訊號 · 耗時 {response.elapsedMs}ms
            </p>
          </div>
          <DataSourceBadge freshness={response.freshness as never} />
        </CardHeader>

        {response.warnings.length > 0 && (
          <div className="mb-3 flex flex-col gap-1">
            {response.warnings.map((w, i) => (
              <div key={i} className="rounded-md border border-[var(--color-warn)]/40 bg-[var(--color-warn)]/10 px-2 py-1.5 text-xs text-[var(--color-warn)]">
                ⚠ {w.message}
              </div>
            ))}
          </div>
        )}

        <MetricsGrid metrics={response.metrics} />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>資金曲線（策略 vs. 買進持有）</CardTitle>
        </CardHeader>
        <EquityCurveChart data={response.equityCurve} />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>回撤曲線</CardTitle>
        </CardHeader>
        <DrawdownChart data={response.equityCurve} />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>月報酬熱圖</CardTitle>
        </CardHeader>
        <MonthlyReturnHeatmap data={response.equityCurve} />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>交易損益分布</CardTitle>
        </CardHeader>
        <TradePnlHistogram trades={response.trades} />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>交易紀錄</CardTitle>
        </CardHeader>
        <TradesTable trades={response.trades} />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>進階分析</CardTitle>
        </CardHeader>
        <Tabs
          tabs={[
            { id: "sensitivity", label: "參數敏感度分析", content: <SensitivityPanel run={run} /> },
            { id: "walkforward", label: "Walk-Forward 分析", content: <WalkForwardPanel run={run} /> },
          ]}
        />
      </Card>
    </div>
  );
}
