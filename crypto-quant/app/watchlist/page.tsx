"use client";

import { useState } from "react";
import Link from "next/link";
import { RiskBanner } from "@/components/common/RiskBanner";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { ErrorState, LoadingState, EmptyState } from "@/components/common/StatusStates";
import { DataSourceBadge } from "@/components/common/DataSourceBadge";
import { useAddWatchlist, useRemoveWatchlist, useSymbols, useTicker, useWatchlist, useWatchlistSignal } from "@/lib/client/hooks";
import { formatDateTime, formatPercent, formatUsdt, signClass, signPrefix } from "@/lib/format";
import type { WatchlistItem } from "@/lib/storage/watchlistRepo";

function SignalCell({ symbol }: { symbol: string }) {
  const { data, isLoading, isError } = useWatchlistSignal(symbol);

  if (isLoading) return <span className="text-[var(--color-text-muted)]">載入中…</span>;
  if (isError) return <span className="text-[var(--color-text-muted)]">無法取得</span>;
  if (!data?.signal) return <span className="text-[var(--color-text-muted)]">尚無訊號</span>;

  const { signal } = data;
  const isBullish = signal.type === "bullish_candidate";
  const isBearish = signal.type === "bearish_candidate";
  return (
    <span className={isBullish ? "text-[var(--color-up)]" : isBearish ? "text-[var(--color-down)]" : "text-[var(--color-text-muted)]"}>
      {signal.label}
      <span className="ml-1 text-[var(--color-text-muted)]">（{formatDateTime(signal.time)}）</span>
    </span>
  );
}

function WatchlistRow({ item, onRemove }: { item: WatchlistItem; onRemove: (id: string) => void }) {
  const { data, isLoading } = useTicker(item.symbol);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <tr className="border-t border-[var(--color-border)]">
      <td className="p-2">
        <Link href={`/market?symbol=${item.symbol}`} className="font-medium text-[var(--color-text)] hover:text-[var(--color-accent)]">
          {item.symbol}
        </Link>
      </td>
      <td className="p-2 text-right">
        {isLoading ? "載入中…" : !data || data.unavailable ? "目前無法取得資料" : formatUsdt(data.data.price)}
      </td>
      <td className="p-2 text-right">
        {data && !data.unavailable ? (
          <span className={signClass(data.data.changePercent24h)}>
            {signPrefix(data.data.changePercent24h)} {formatPercent(data.data.changePercent24h)}
          </span>
        ) : (
          "—"
        )}
      </td>
      <td className="p-2">
        <SignalCell symbol={item.symbol} />
      </td>
      <td className="p-2 text-[var(--color-text-muted)]">{item.note || "—"}</td>
      <td className="p-2">{data && !data.unavailable && <DataSourceBadge freshness={data.freshness} fetchedAt={data.data.fetchedAt} />}</td>
      <td className="p-2 text-right">
        {confirmDelete ? (
          <span className="flex justify-end gap-1">
            <Button variant="danger" className="!px-2 !py-1" onClick={() => onRemove(item.id)}>
              確定？
            </Button>
            <Button variant="ghost" className="!px-2 !py-1" onClick={() => setConfirmDelete(false)}>
              取消
            </Button>
          </span>
        ) : (
          <Button variant="ghost" className="!px-2 !py-1 text-[var(--color-down)]" onClick={() => setConfirmDelete(true)}>
            移除
          </Button>
        )}
      </td>
    </tr>
  );
}

export default function WatchlistPage() {
  const { data, isLoading, isError, error, refetch } = useWatchlist();
  const { data: symbolsData } = useSymbols();
  const addMutation = useAddWatchlist();
  const removeMutation = useRemoveWatchlist();

  const [symbol, setSymbol] = useState("BTCUSDT");
  const [note, setNote] = useState("");

  const handleAdd = () => {
    addMutation.mutate({ symbol, note: note || undefined });
    setNote("");
  };

  return (
    <div className="flex flex-col gap-4">
      <RiskBanner />
      <h1 className="text-lg font-bold text-[var(--color-text)]">觀察清單</h1>

      <Card>
        <CardHeader>
          <CardTitle>新增觀察項目</CardTitle>
        </CardHeader>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="交易對">
            <Select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
              {(symbolsData?.symbols ?? []).map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.displayName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="備註（選填）">
            <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="例如：關注 EMA 黃金交叉" />
          </Field>
          <Button onClick={handleAdd} disabled={addMutation.isPending}>
            加入觀察清單
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>我的觀察清單</CardTitle>
        </CardHeader>
        <p className="text-xs text-[var(--color-text-muted)]">
          「目前訊號」欄位是將本站「FVG 價格失衡區＋供需區策略」以預設參數套用在該交易對 1 小時 K 棒上的最新偵測結果，純屬歷史價格結構分析，不是買賣建議，也不是依市場數據排出的多空推薦名單。
        </p>
        {isLoading && <LoadingState />}
        {isError && <ErrorState message={error instanceof Error ? error.message : "載入失敗"} onRetry={() => refetch()} />}
        {!isLoading && !isError && (data?.items.length ?? 0) === 0 && <EmptyState message="觀察清單目前是空的" />}
        {!isLoading && !isError && (data?.items.length ?? 0) > 0 && (
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[640px] text-xs">
              <thead className="text-[var(--color-text-muted)]">
                <tr>
                  <th className="p-2 text-left">交易對</th>
                  <th className="p-2 text-right">目前價格</th>
                  <th className="p-2 text-right">24h 漲跌</th>
                  <th className="p-2 text-left">目前訊號</th>
                  <th className="p-2 text-left">備註</th>
                  <th className="p-2 text-left">資料狀態</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {data!.items.map((item) => (
                  <WatchlistRow key={item.id} item={item} onRemove={(id) => removeMutation.mutate(id)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
