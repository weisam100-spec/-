"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useWatchlistAnalysis } from "@/hooks/useWatchlistAnalysis";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MockDataBanner } from "@/components/common/MockDataBanner";
import { formatNumber, formatPercent, formatSigned } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

export default function WatchlistPage() {
  const { items, hydrated, remove } = useWatchlist();
  const symbols = items.map((i) => i.symbol);
  const { data, isLoading } = useWatchlistAnalysis(symbols);

  const rows = data ?? [];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-xl font-bold">⭐ 我的自選股</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          追蹤你關注的股票，快速比較價格、AI 分數與技術面訊號。
        </p>
      </div>

      <MockDataBanner />

      {!hydrated || (symbols.length > 0 && isLoading) ? (
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      ) : symbols.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-12 text-center text-sm text-muted-foreground">
            尚未加入任何自選股。
            <Link href="/" className="font-medium text-foreground underline underline-offset-2">
              回首頁搜尋股票
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">股票</th>
                  <th className="px-4 py-3 font-medium">價格</th>
                  <th className="px-4 py-3 font-medium">漲跌幅</th>
                  <th className="px-4 py-3 font-medium">AI Score</th>
                  <th className="px-4 py-3 font-medium">趨勢</th>
                  <th className="px-4 py-3 font-medium">RSI</th>
                  <th className="px-4 py-3 font-medium">法人買賣超（5日）</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const up = row.quote.change >= 0;
                  return (
                    <tr key={row.quote.symbol} className="border-b border-border last:border-0 hover:bg-accent">
                      <td className="px-4 py-3">
                        <Link href={`/stock/${row.quote.symbol}`} className="block">
                          <div className="font-semibold">{row.quote.name}</div>
                          <div className="text-xs text-muted-foreground">{row.quote.symbol}</div>
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-medium">{formatNumber(row.quote.price, 1)}</td>
                      <td className={cn("px-4 py-3 font-medium", up ? "text-up" : "text-down")}>
                        {formatSigned(row.quote.change, 1)}（{formatPercent(row.quote.changePercent)}）
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            row.score.label === "偏多" ? "up" : row.score.label === "偏空" ? "down" : "muted"
                          }
                        >
                          {row.score.total} 分・{row.score.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">{row.technicalAnalysis.trendPattern}</td>
                      <td className="px-4 py-3">{row.technical.rsi14}</td>
                      <td className="px-4 py-3 text-xs">
                        <div>外資 {formatSigned(row.institutional.foreign.last5d, 0)} 張</div>
                        <div className="text-muted-foreground">
                          投信 {formatSigned(row.institutional.trust.last5d, 0)} 張
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => remove(row.quote.symbol)}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                          title="移除自選股"
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
      )}
    </div>
  );
}
