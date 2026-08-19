"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StockQuoteRow } from "@/components/stock/StockQuoteRow";
import { useHotStocks } from "@/hooks/useHotStocks";
import { useWatchlist } from "@/hooks/useWatchlist";

export function HotStockList() {
  const { data, isLoading } = useHotStocks(5);
  const { isWatched, toggle } = useWatchlist();

  return (
    <Card>
      <CardHeader>
        <CardTitle>🔥 熱門股票</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {isLoading || !data
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
            ))
          : data.map((quote) => (
              <StockQuoteRow
                key={quote.symbol}
                quote={quote}
                isWatched={isWatched(quote.symbol)}
                onToggleWatch={() => toggle(quote.symbol, quote.name)}
              />
            ))}
      </CardContent>
    </Card>
  );
}
