"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StockQuoteRow } from "@/components/stock/StockQuoteRow";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useStockQuotes } from "@/hooks/useStockQuotes";

export function WatchlistPreview() {
  const { items, hydrated, toggle, isWatched } = useWatchlist();
  const symbols = items.map((i) => i.symbol);
  const { data, isLoading } = useStockQuotes(symbols);

  return (
    <Card>
      <CardHeader>
        <CardTitle>⭐ 我的自選股</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {!hydrated || (symbols.length > 0 && isLoading) ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
          ))
        ) : symbols.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            尚未加入任何自選股，搜尋股票後即可加入。
            <br />
            <Link href="/watchlist" className="text-foreground underline underline-offset-2">
              前往自選股頁面
            </Link>
          </p>
        ) : (
          data?.map((quote) => (
            <StockQuoteRow
              key={quote.symbol}
              quote={quote}
              isWatched={isWatched(quote.symbol)}
              onToggleWatch={() => toggle(quote.symbol, quote.name)}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}
