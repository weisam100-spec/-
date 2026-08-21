"use client";

import Link from "next/link";
import { X } from "lucide-react";
import type { HoldingItem, HoldingMetrics, StockQuote } from "@/lib/types/stock";
import { Card, CardContent } from "@/components/ui/card";
import { formatNumber, formatPercent, formatSigned } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

export function HoldingsTable({
  holdings,
  quoteBySymbol,
  metricsBySymbol,
  onRemove,
}: {
  holdings: HoldingItem[];
  quoteBySymbol: Record<string, StockQuote>;
  metricsBySymbol: Record<string, HoldingMetrics>;
  onRemove: (symbol: string) => void;
}) {
  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">股票</th>
              <th className="px-4 py-3 font-medium">現價</th>
              <th className="px-4 py-3 font-medium">持有股數</th>
              <th className="px-4 py-3 font-medium">平均成本</th>
              <th className="px-4 py-3 font-medium">成本</th>
              <th className="px-4 py-3 font-medium">市值</th>
              <th className="px-4 py-3 font-medium">未實現損益</th>
              <th className="px-4 py-3 font-medium">報酬率</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {holdings.map((h) => {
              const quote = quoteBySymbol[h.symbol];
              const metrics = metricsBySymbol[h.symbol];
              const up = metrics && metrics.unrealizedPL >= 0;
              return (
                <tr key={h.symbol} className="border-b border-border last:border-0 hover:bg-accent">
                  <td className="px-4 py-3">
                    <Link href={`/stock/${h.symbol}`} className="block">
                      <div className="font-semibold">{h.name}</div>
                      <div className="text-xs text-muted-foreground">{h.symbol}</div>
                    </Link>
                  </td>
                  <td className="px-4 py-3">{quote ? formatNumber(quote.price, 1) : "—"}</td>
                  <td className="px-4 py-3">{formatNumber(h.shares, 0)}</td>
                  <td className="px-4 py-3">{formatNumber(h.avgCost, 1)}</td>
                  <td className="px-4 py-3">{metrics ? formatNumber(metrics.costBasis, 0) : "—"}</td>
                  <td className="px-4 py-3">{metrics ? formatNumber(metrics.marketValue, 0) : "—"}</td>
                  <td className={cn("px-4 py-3 font-medium", metrics && (up ? "text-up" : "text-down"))}>
                    {metrics ? formatSigned(metrics.unrealizedPL, 0) : "—"}
                  </td>
                  <td className={cn("px-4 py-3 font-medium", metrics && (up ? "text-up" : "text-down"))}>
                    {metrics ? formatPercent(metrics.returnPercent) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onRemove(h.symbol)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                      title="移除持股"
                    >
                      <X className="size-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
