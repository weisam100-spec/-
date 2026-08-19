"use client";

import { Star } from "lucide-react";
import type { StockQuote } from "@/lib/types/stock";
import { Button } from "@/components/ui/button";
import { useWatchlist } from "@/hooks/useWatchlist";
import { formatNumber, formatPercent, formatSigned } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

export function StockHeader({ quote }: { quote: StockQuote }) {
  const { isWatched, toggle } = useWatchlist();
  const up = quote.change >= 0;
  const watched = isWatched(quote.symbol);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-2">
            <h1 className="text-2xl font-bold">{quote.name}</h1>
            <span className="text-sm text-muted-foreground">{quote.symbol}</span>
          </div>
          <div className={cn("mt-1 flex items-baseline gap-2", up ? "text-up" : "text-down")}>
            <span className="text-4xl font-extrabold">{formatNumber(quote.price, 1)}</span>
            <span className="text-lg font-semibold">
              {formatSigned(quote.change, 1)}（{formatPercent(quote.changePercent)}）
            </span>
          </div>
        </div>
        <Button
          variant={watched ? "secondary" : "outline"}
          onClick={() => toggle(quote.symbol, quote.name)}
        >
          <Star className={cn("size-4", watched && "fill-amber-400 text-amber-400")} />
          {watched ? "已加入自選股" : "加入自選股"}
        </Button>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
        <span>開盤 {formatNumber(quote.open, 1)}</span>
        <span>最高 {formatNumber(quote.high, 1)}</span>
        <span>最低 {formatNumber(quote.low, 1)}</span>
        <span>昨收 {formatNumber(quote.prevClose, 1)}</span>
        <span>成交量 {formatNumber(quote.volume, 0)} 張</span>
        <span>成交金額 {formatNumber(quote.amount / 1_0000_0000, 1)} 億</span>
      </div>
    </div>
  );
}
