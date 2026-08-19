"use client";

import { useQuery } from "@tanstack/react-query";
import type { StockQuote } from "@/lib/types/stock";
import { fetchJson } from "@/lib/utils/fetchJson";

export function useStockQuotes(symbols: string[]) {
  const key = [...symbols].sort().join(",");
  return useQuery<StockQuote[]>({
    queryKey: ["stock-quotes", key],
    queryFn: () => fetchJson(`/api/stock/quotes?symbols=${encodeURIComponent(key)}`),
    enabled: symbols.length > 0,
    refetchInterval: 60_000,
  });
}
