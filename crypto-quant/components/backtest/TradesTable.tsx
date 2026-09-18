"use client";

import { useMemo, useState } from "react";
import { Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { formatDateTime, formatDuration, formatUsdt, signClass } from "@/lib/format";
import type { TradeRecord } from "@/lib/backtest/types";

type SortKey = "entryTime" | "pnl" | "returnPct" | "holdingMs";
type FilterKind = "all" | "win" | "loss";

function toCsv(trades: TradeRecord[]): string {
  const header = ["進場時間", "進場價格", "出場時間", "出場價格", "數量", "交易成本", "損益", "報酬率(%)", "持倉時間(ms)", "進場原因", "出場原因"];
  const rows = trades.map((t) => [
    formatDateTime(t.entryTime),
    t.entryPrice.toFixed(6),
    formatDateTime(t.exitTime),
    t.exitPrice.toFixed(6),
    t.quantity.toFixed(8),
    t.totalCost.toFixed(4),
    t.pnl.toFixed(4),
    t.returnPct.toFixed(2),
    String(t.holdingMs),
    `"${t.entryReason.replace(/"/g, '""')}"`,
    `"${t.exitReason.replace(/"/g, '""')}"`,
  ]);
  return [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

export function TradesTable({ trades }: { trades: TradeRecord[] }) {
  const [filter, setFilter] = useState<FilterKind>("all");
  const [sortKey, setSortKey] = useState<SortKey>("entryTime");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    let list = trades;
    if (filter === "win") list = list.filter((t) => t.pnl > 0);
    if (filter === "loss") list = list.filter((t) => t.pnl < 0);
    const sorted = [...list].sort((a, b) => (sortDir === "asc" ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey]));
    return sorted;
  }, [trades, filter, sortKey, sortDir]);

  const handleExport = () => {
    const csv = toCsv(filtered);
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trades-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (trades.length === 0) {
    return <p className="text-sm text-[var(--color-text-muted)]">此次回測沒有任何成交紀錄。</p>;
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Select value={filter} onChange={(e) => setFilter(e.target.value as FilterKind)} className="w-28">
          <option value="all">全部交易</option>
          <option value="win">獲利交易</option>
          <option value="loss">虧損交易</option>
        </Select>
        <Select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className="w-32">
          <option value="entryTime">依時間排序</option>
          <option value="pnl">依損益排序</option>
          <option value="returnPct">依報酬率排序</option>
          <option value="holdingMs">依持倉時間排序</option>
        </Select>
        <Select value={sortDir} onChange={(e) => setSortDir(e.target.value as "asc" | "desc")} className="w-24">
          <option value="desc">遞減</option>
          <option value="asc">遞增</option>
        </Select>
        <Button variant="secondary" onClick={handleExport} className="ml-auto !px-2 !py-1 text-xs">
          匯出 CSV
        </Button>
      </div>

      <div className="scrollbar-thin max-h-[420px] overflow-auto rounded-md border border-[var(--color-border)]">
        <table className="w-full min-w-[720px] text-xs">
          <thead className="sticky top-0 bg-[var(--color-surface-raised)] text-[var(--color-text-muted)]">
            <tr>
              <th className="p-2 text-left">進場時間</th>
              <th className="p-2 text-right">進場價格</th>
              <th className="p-2 text-left">出場時間</th>
              <th className="p-2 text-right">出場價格</th>
              <th className="p-2 text-right">數量</th>
              <th className="p-2 text-right">交易成本</th>
              <th className="p-2 text-right">損益</th>
              <th className="p-2 text-right">報酬率</th>
              <th className="p-2 text-right">持倉時間</th>
              <th className="p-2 text-left">出場原因</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t, i) => (
              <tr key={i} className="border-t border-[var(--color-border)]">
                <td className="p-2">{formatDateTime(t.entryTime)}</td>
                <td className="p-2 text-right">{t.entryPrice.toFixed(2)}</td>
                <td className="p-2">{formatDateTime(t.exitTime)}</td>
                <td className="p-2 text-right">{t.exitPrice.toFixed(2)}</td>
                <td className="p-2 text-right">{t.quantity.toFixed(4)}</td>
                <td className="p-2 text-right">{t.totalCost.toFixed(2)}</td>
                <td className={`p-2 text-right font-medium ${signClass(t.pnl)}`}>{formatUsdt(t.pnl)}</td>
                <td className={`p-2 text-right font-medium ${signClass(t.returnPct)}`}>{t.returnPct.toFixed(2)}%</td>
                <td className="p-2 text-right">{formatDuration(t.holdingMs)}</td>
                <td className="max-w-[200px] truncate p-2" title={t.exitReason}>
                  {t.exitReason}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
