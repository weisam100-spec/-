import { formatDateTime } from "@/lib/format";
import type { DataFreshness } from "@/lib/market/types";

const LABEL: Record<DataFreshness, string> = {
  live: "即時",
  delayed: "延遲",
  historical: "歷史資料",
  demo: "DEMO 模擬資料",
};

const STYLE: Record<DataFreshness, string> = {
  live: "border-[var(--color-up)]/40 text-[var(--color-up)] bg-[var(--color-up-soft)]/40",
  delayed: "border-[var(--color-warn)]/40 text-[var(--color-warn)] bg-[var(--color-warn)]/10",
  historical: "border-[var(--color-border)] text-[var(--color-text-muted)] bg-[var(--color-surface-raised)]",
  demo: "border-[var(--color-warn)]/50 text-[var(--color-warn)] bg-[var(--color-warn)]/15",
};

export function DataSourceBadge({ freshness, fetchedAt }: { freshness: DataFreshness; fetchedAt?: number }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${STYLE[freshness]}`}
      title={fetchedAt ? `資料更新時間：${formatDateTime(fetchedAt)}` : undefined}
    >
      {freshness === "demo" && "⚠ "}
      {LABEL[freshness]}
      {fetchedAt && <span className="text-[var(--color-text-muted)]">· {formatDateTime(fetchedAt)}</span>}
    </span>
  );
}
