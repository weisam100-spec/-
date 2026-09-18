"use client";

import { useSymbols, useTicker, useFxRate } from "@/lib/client/hooks";
import { Card } from "@/components/ui/Card";
import { DataSourceBadge } from "@/components/common/DataSourceBadge";
import { LoadingState } from "@/components/common/StatusStates";
import { formatCompactNumber, formatPercent, formatTwd, formatUsdt, signClass, signPrefix } from "@/lib/format";
import { usdtToTwd } from "@/lib/market/fx";
import type { SymbolMeta } from "@/lib/market/symbols";

function TickerCard({ meta }: { meta: SymbolMeta }) {
  const { data, isLoading, isError } = useTicker(meta.symbol);
  const { data: fx } = useFxRate();

  if (isLoading) {
    return (
      <Card>
        <LoadingState label={`載入 ${meta.symbol}…`} />
      </Card>
    );
  }

  if (isError || !data || data.unavailable) {
    return (
      <Card>
        <p className="text-sm font-semibold text-[var(--color-text)]">{meta.displayName}</p>
        <p className="mt-3 text-xs text-[var(--color-text-muted)]">
          目前無法取得資料{data?.unavailable ? `：${data.unavailable.reason}` : ""}
        </p>
      </Card>
    );
  }

  const t = data.data;
  const twdPrice = fx ? usdtToTwd(t.price, fx.usdtTwd) : null;

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--color-text)]">{meta.displayName}</p>
          <p className="mt-1 text-lg font-bold text-[var(--color-text)]">{formatUsdt(t.price)}</p>
          {twdPrice !== null && <p className="text-xs text-[var(--color-text-muted)]">≈ {formatTwd(twdPrice)}</p>}
        </div>
        <span className={`flex items-center gap-1 text-sm font-medium ${signClass(t.changePercent24h)}`}>
          {signPrefix(t.changePercent24h)} {formatPercent(t.changePercent24h)}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-[var(--color-text-muted)]">
        <span>24h 量 {formatCompactNumber(t.volume24h)} {meta.base}</span>
        <DataSourceBadge freshness={data.freshness} fetchedAt={t.fetchedAt} />
      </div>
    </Card>
  );
}

export function MarketSummaryGrid() {
  const { data, isLoading } = useSymbols();
  if (isLoading || !data) {
    return <LoadingState label="載入支援交易對清單…" />;
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {data.symbols.map((s) => (
        <TickerCard key={s.symbol} meta={s} />
      ))}
    </div>
  );
}
