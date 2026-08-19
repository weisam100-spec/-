"use client";

import Link from "next/link";
import { Star } from "lucide-react";
import type { StockQuote } from "@/lib/types/stock";
import { formatNumber, formatPercent, formatSigned } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

export function StockQuoteRow({
  quote,
  isWatched,
  onToggleWatch,
}: {
  quote: StockQuote;
  isWatched?: boolean;
  onToggleWatch?: () => void;
}) {
  const up = quote.change >= 0;
  return (
    <div className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-accent">
      <Link href={`/stock/${quote.symbol}`} className="flex flex-1 items-center justify-between gap-3">
        <div>
          <div className="font-semibold">{quote.name}</div>
          <div className="text-xs text-muted-foreground">{quote.symbol}</div>
        </div>
        <div className={cn("text-right text-sm font-bold", up ? "text-up" : "text-down")}>
          <div>{formatNumber(quote.price, 1)}</div>
          <div className="text-xs font-medium">
            {formatSigned(quote.change, 1)}（{formatPercent(quote.changePercent)}）
          </div>
        </div>
      </Link>
      {onToggleWatch && (
        <button
          type="button"
          onClick={onToggleWatch}
          className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:text-amber-500"
          title="加入自選股"
        >
          <Star className={cn("size-4", isWatched && "fill-amber-400 text-amber-400")} />
        </button>
      )}
    </div>
  );
}
