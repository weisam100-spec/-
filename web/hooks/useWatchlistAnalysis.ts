"use client";

import { useQuery } from "@tanstack/react-query";
import type { StockAnalysisResponse } from "@/lib/types/stock";
import { fetchJson } from "@/lib/utils/fetchJson";

export function useWatchlistAnalysis(symbols: string[]) {
  const key = [...symbols].sort().join(",");
  return useQuery<StockAnalysisResponse[]>({
    queryKey: ["watchlist-analysis", key],
    queryFn: () => fetchJson(`/api/stock/analysis?symbols=${encodeURIComponent(key)}`),
    enabled: symbols.length > 0,
    refetchInterval: 60_000,
  });
}
