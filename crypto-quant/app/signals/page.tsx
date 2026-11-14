"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { RiskBanner } from "@/components/common/RiskBanner";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Field";
import { ErrorState, LoadingState, EmptyState } from "@/components/common/StatusStates";
import { DataSourceBadge } from "@/components/common/DataSourceBadge";
import { Sparkline } from "@/components/charts/Sparkline";
import { useTrendSignalScan, type TrendSignalScanItem } from "@/lib/client/hooks";
import { formatDateTime, formatDuration, formatPercent, formatUsdt, signClass, signPrefix } from "@/lib/format";
import { cn } from "@/lib/cn";

type IntervalTab = "5m" | "15m";
type DirectionFilter = "all" | "bullish_candidate" | "bearish_candidate";

const HIGH_QUALITY_THRESHOLD = 75;

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-3 py-1.5 text-xs font-medium transition",
        active
          ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
          : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
      )}
    >
      {children}
    </button>
  );
}

function SignalCard({ item, interval }: { item: TrendSignalScanItem; interval: IntervalTab }) {
  if (item.unavailable || !item.card) {
    return (
      <Card>
        <div className="flex items-center justify-between">
          <span className="font-medium text-[var(--color-text)]">{item.displayName}</span>
        </div>
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">{item.unavailable ?? "目前無法取得資料"}</p>
      </Card>
    );
  }

  const { card } = item;
  const isBullish = card.signal?.type === "bullish_candidate";
  const isBearish = card.signal?.type === "bearish_candidate";
  const isHighQuality = (card.signal?.confidence ?? 0) >= HIGH_QUALITY_THRESHOLD;
  const lineColor = isBullish ? "#22c55e" : isBearish ? "#ef4444" : "#8a93a3";

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Link href={`/market?symbol=${item.symbol}`} className="font-bold text-[var(--color-text)] hover:text-[var(--color-accent)]">
            {item.symbol.replace("USDT", "")}
          </Link>
          {card.signal && isHighQuality && (
            <span className="rounded-full border border-[var(--color-warn)]/40 bg-[var(--color-warn)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--color-warn)]">
              高品質
            </span>
          )}
          {item.freshness && <DataSourceBadge freshness={item.freshness} fetchedAt={Date.now()} />}
        </div>
        {card.signal && (
          <span className="shrink-0 text-[11px] text-[var(--color-text-muted)]">{formatDuration(Date.now() - card.signal.time)}前</span>
        )}
      </div>

      <div className="mt-2">
        <Sparkline data={card.sparkline} color={lineColor} />
        <div className="flex justify-between text-[10px] text-[var(--color-text-muted)]">
          <span>低 {formatUsdt(card.windowLow)}</span>
          <span>最近 12 小時</span>
          <span>高 {formatUsdt(card.windowHigh)}</span>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-[var(--color-text-muted)]">方向</p>
          <p className={cn("font-medium", isBullish ? "text-[var(--color-up)]" : isBearish ? "text-[var(--color-down)]" : "text-[var(--color-text-muted)]")}>
            {card.signal?.label ?? "尚無訊號"}
          </p>
        </div>
        <div>
          <p className="text-[var(--color-text-muted)]">狀態</p>
          <p className={card.changeSinceSignalPct !== null ? signClass(card.changeSinceSignalPct) : undefined}>
            {card.changeSinceSignalPct !== null
              ? `${signPrefix(card.changeSinceSignalPct)} ${formatPercent(card.changeSinceSignalPct)}`
              : "—"}
          </p>
        </div>
        <div>
          <p className="text-[var(--color-text-muted)]">週期</p>
          <p className="font-medium text-[var(--color-text)]">{interval === "5m" ? "5 分鐘" : "15 分鐘"}</p>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-[var(--color-border)] pt-2">
        <div className="text-xs">
          <p className="text-[var(--color-text-muted)]">觸發價格</p>
          <p className="font-medium text-[var(--color-text)]">{card.signal ? formatUsdt(card.signal.price) : "—"}</p>
        </div>
        <Link href={`/market?symbol=${item.symbol}`}>
          <Button variant="secondary" className="!px-3 !py-1.5 text-xs">
            查看詳情
          </Button>
        </Link>
      </div>
      {card.signal && (
        <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
          {formatDateTime(card.signal.time)} 觸發 · 信心 {card.signal.confidence}（僅供參考，非勝率保證）
        </p>
      )}
    </Card>
  );
}

export default function SignalsPage() {
  const [interval, setInterval] = useState<IntervalTab>("5m");
  const [direction, setDirection] = useState<DirectionFilter>("all");
  const [highQualityOnly, setHighQualityOnly] = useState(false);
  const { data, isLoading, isError, error, refetch } = useTrendSignalScan(interval);

  const filteredItems = useMemo(() => {
    const items = data?.items ?? [];
    return items.filter((item) => {
      const signal = item.card?.signal;
      if (direction !== "all" && signal?.type !== direction) return false;
      if (highQualityOnly && (!signal || signal.confidence < HIGH_QUALITY_THRESHOLD)) return false;
      return true;
    });
  }, [data, direction, highQualityOnly]);

  return (
    <div className="flex flex-col gap-4">
      <RiskBanner />
      <h1 className="text-lg font-bold text-[var(--color-text)]">趨勢訊號</h1>
      <p className="text-sm text-[var(--color-text-muted)]">
        對本站支援的所有交易對，批次套用既有的「FVG 價格失衡區＋供需區策略」（預設參數），整理成卡片顯示每個交易對目前的最新候選訊號。這只是把同一套公開定義的歷史結構分析規則，獨立套用在每個交易對上的呈現方式，不是依市場數據排出的多空推薦名單，也不構成投資建議。
      </p>

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1.5">
            <TabButton active={interval === "5m"} onClick={() => setInterval("5m")}>
              5 分鐘
            </TabButton>
            <TabButton active={interval === "15m"} onClick={() => setInterval("15m")}>
              15 分鐘
            </TabButton>
          </div>
          <div className="flex gap-1.5">
            <TabButton active={direction === "all"} onClick={() => setDirection("all")}>
              全部
            </TabButton>
            <TabButton active={direction === "bullish_candidate"} onClick={() => setDirection("bullish_candidate")}>
              偏多候選
            </TabButton>
            <TabButton active={direction === "bearish_candidate"} onClick={() => setDirection("bearish_candidate")}>
              偏空候選
            </TabButton>
          </div>
          <Checkbox label="只看高品質" checked={highQualityOnly} onChange={(e) => setHighQualityOnly(e.target.checked)} />
        </div>
      </Card>

      {isLoading && <LoadingState />}
      {isError && <ErrorState message={error instanceof Error ? error.message : "載入失敗"} onRetry={() => refetch()} />}
      {!isLoading && !isError && filteredItems.length === 0 && <EmptyState message="目前沒有符合篩選條件的交易對" />}
      {!isLoading && !isError && filteredItems.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => (
            <SignalCard key={item.symbol} item={item} interval={interval} />
          ))}
        </div>
      )}

      {data?.disclaimer && <p className="text-xs text-[var(--color-text-muted)]">{data.disclaimer}</p>}
    </div>
  );
}
