"use client";

import { Card, CardContent } from "@/components/ui/card";
import { useMarketOverview } from "@/hooks/useMarketOverview";
import { formatNumber, formatPercent, formatSigned } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "up" | "down";
}) {
  return (
    <div className="flex flex-1 flex-col gap-1 rounded-xl bg-muted px-4 py-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-lg font-bold",
          tone === "up" && "text-up",
          tone === "down" && "text-down"
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function MarketOverviewCard() {
  const { data, isLoading } = useMarketOverview();

  return (
    <Card>
      <CardContent className="flex flex-wrap gap-3 p-4">
        {isLoading || !data ? (
          <div className="h-16 w-full animate-pulse rounded-xl bg-muted" />
        ) : (
          <>
            <StatTile
              label="加權指數"
              tone={data.indexChange >= 0 ? "up" : "down"}
              value={
                <span className="flex items-baseline gap-1">
                  {formatNumber(data.indexValue, 0)}
                  <span className="text-xs font-medium">
                    {formatSigned(data.indexChange, 0)}（{formatPercent(data.indexChangePercent)}）
                  </span>
                </span>
              }
            />
            <StatTile label="今日上漲家數" tone="up" value={`${data.advancers} 家`} />
            <StatTile label="今日下跌家數" tone="down" value={`${data.decliners} 家`} />
            <StatTile label="成交量" value={`${formatNumber(data.totalVolume, 0)} 億`} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
