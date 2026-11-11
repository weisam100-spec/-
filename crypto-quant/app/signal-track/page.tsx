"use client";

import { useMemo } from "react";
import { RiskBanner } from "@/components/common/RiskBanner";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorState, LoadingState, EmptyState } from "@/components/common/StatusStates";
import { SignalBadge } from "@/components/common/SignalBadge";
import { useSignalTracks } from "@/lib/client/hooks";
import { formatDateTime, formatUsdt } from "@/lib/format";
import type { SignalTrackRecord, SignalTrackStatus } from "@/lib/storage/signalTrackRepo";

const STATUS_LABEL: Record<SignalTrackStatus, string> = {
  pending: "追蹤中",
  hit_stop: "碰到停損",
  hit_rr2: "達成 1:2 停利",
  hit_rr3: "達成 1:3 停利",
  no_result: "逾時未解",
};

const STATUS_CLASS: Record<SignalTrackStatus, string> = {
  pending: "text-[var(--color-text-muted)] border-[var(--color-border)] bg-[var(--color-surface-raised)]",
  hit_stop: "text-[var(--color-down)] border-[var(--color-down)]/40 bg-[var(--color-down-soft)]/40",
  hit_rr2: "text-[var(--color-up)] border-[var(--color-up)]/40 bg-[var(--color-up-soft)]/40",
  hit_rr3: "text-[var(--color-up)] border-[var(--color-up)]/40 bg-[var(--color-up-soft)]/40",
  no_result: "text-[var(--color-warn)] border-[var(--color-warn)]/40 bg-[var(--color-warn)]/10",
};

function StatusBadge({ status }: { status: SignalTrackStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function summarize(records: SignalTrackRecord[]) {
  const counts: Record<SignalTrackStatus, number> = {
    pending: 0,
    hit_stop: 0,
    hit_rr2: 0,
    hit_rr3: 0,
    no_result: 0,
  };
  for (const r of records) counts[r.status]++;
  const resolvedCount = counts.hit_stop + counts.hit_rr2 + counts.hit_rr3;
  const reachedTargetCount = counts.hit_rr2 + counts.hit_rr3;
  const reachedTargetPct = resolvedCount > 0 ? (reachedTargetCount / resolvedCount) * 100 : null;
  return { counts, total: records.length, resolvedCount, reachedTargetPct };
}

export default function SignalTrackPage() {
  const { data, isLoading, isError, error, refetch } = useSignalTracks();
  const records = useMemo(() => data?.records ?? [], [data]);
  const summary = useMemo(() => summarize(records), [records]);

  return (
    <div className="flex flex-col gap-4">
      <RiskBanner />
      <h1 className="text-lg font-bold text-[var(--color-text)]">即時訊號追蹤記錄</h1>

      <Card>
        <p className="text-xs text-[var(--color-text-muted)]">
          這裡記錄的是策略「即時」運作期間實際偵測到的新訊號（由背景排程寫入，不是回測、也不能事後調整），
          並持續追蹤後續走勢，判定最終是先碰到停損、達成 1:2 停利、還是達成 1:3
          停利。這是樣本外（out-of-sample）的真實紀錄，但也因此需要時間累積：剛啟用訊號提醒時這裡會是空的，
          資料只會從啟用之後才開始累積，不會回溯過去的歷史訊號；樣本數太少時（例如少於
          20 筆）任何比例都不具統計意義，僅供參考，不代表未來表現。
        </p>
      </Card>

      {isLoading && <LoadingState />}
      {isError && <ErrorState message={error instanceof Error ? error.message : "載入失敗"} onRetry={() => refetch()} />}

      {!isLoading && !isError && (
        <Card>
          <CardHeader>
            <CardTitle>統計摘要</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-md border border-[var(--color-border)] p-2">
              <p className="text-[11px] text-[var(--color-text-muted)]">總筆數</p>
              <p className="text-sm font-medium text-[var(--color-text)]">{summary.total}</p>
            </div>
            <div className="rounded-md border border-[var(--color-border)] p-2">
              <p className="text-[11px] text-[var(--color-text-muted)]">追蹤中</p>
              <p className="text-sm font-medium text-[var(--color-text)]">{summary.counts.pending}</p>
            </div>
            <div className="rounded-md border border-[var(--color-border)] p-2">
              <p className="text-[11px] text-[var(--color-text-muted)]">碰到停損</p>
              <p className="text-sm font-medium text-[var(--color-down)]">{summary.counts.hit_stop}</p>
            </div>
            <div className="rounded-md border border-[var(--color-border)] p-2">
              <p className="text-[11px] text-[var(--color-text-muted)]">達成 1:2</p>
              <p className="text-sm font-medium text-[var(--color-up)]">{summary.counts.hit_rr2}</p>
            </div>
            <div className="rounded-md border border-[var(--color-border)] p-2">
              <p className="text-[11px] text-[var(--color-text-muted)]">達成 1:3</p>
              <p className="text-sm font-medium text-[var(--color-up)]">{summary.counts.hit_rr3}</p>
            </div>
            <div className="rounded-md border border-[var(--color-border)] p-2">
              <p className="text-[11px] text-[var(--color-text-muted)]">逾時未解</p>
              <p className="text-sm font-medium text-[var(--color-text)]">{summary.counts.no_result}</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">
            已有結果（碰到停損或停利，不含追蹤中與逾時未解）共 {summary.resolvedCount} 筆
            {summary.reachedTargetPct !== null && (
              <>
                ，其中達成停利（1:2 或 1:3）佔{" "}
                <span className="font-medium text-[var(--color-text)]">{summary.reachedTargetPct.toFixed(1)}%</span>
                {summary.resolvedCount < 20 ? "（樣本數過少，僅供參考）" : ""}
              </>
            )}
            。
          </p>
        </Card>
      )}

      {!isLoading && !isError && (
        <Card>
          <CardHeader>
            <CardTitle>追蹤明細</CardTitle>
          </CardHeader>
          {records.length === 0 ? (
            <EmptyState
              message="目前沒有任何追蹤紀錄"
              hint="請先到「訊號提醒」頁啟用至少一組策略設定的即時提醒，之後偵測到的新訊號才會開始記錄在這裡"
            />
          ) : (
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full min-w-[920px] text-xs">
                <thead className="text-[var(--color-text-muted)]">
                  <tr>
                    <th className="p-2 text-left">策略設定</th>
                    <th className="p-2 text-left">交易對／週期</th>
                    <th className="p-2 text-left">訊號時間</th>
                    <th className="p-2 text-left">類型</th>
                    <th className="p-2 text-right">進場參考價</th>
                    <th className="p-2 text-right">停損參考價</th>
                    <th className="p-2 text-right">1:2 停利</th>
                    <th className="p-2 text-right">1:3 停利</th>
                    <th className="p-2 text-left">狀態</th>
                    <th className="p-2 text-left">判定時間</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-t border-[var(--color-border)]">
                      <td className="p-2">{r.configName}</td>
                      <td className="p-2">
                        {r.symbol} · {r.interval}
                      </td>
                      <td className="p-2">{formatDateTime(r.signalTime)}</td>
                      <td className="p-2">
                        <SignalBadge type={r.signalType} />
                      </td>
                      <td className="p-2 text-right">{formatUsdt(r.entryPrice, { decimals: 2 })}</td>
                      <td className="p-2 text-right">{r.stopPrice !== null ? formatUsdt(r.stopPrice, { decimals: 2 }) : "—"}</td>
                      <td className="p-2 text-right">{r.rr2Price !== null ? formatUsdt(r.rr2Price, { decimals: 2 }) : "—"}</td>
                      <td className="p-2 text-right">{r.rr3Price !== null ? formatUsdt(r.rr3Price, { decimals: 2 }) : "—"}</td>
                      <td className="p-2">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="p-2">{r.resolvedAt ? formatDateTime(r.resolvedAt) : "—"}</td>
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
