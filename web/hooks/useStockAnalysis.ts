"use client";

import { useQuery } from "@tanstack/react-query";
import type { StockAnalysisResponse } from "@/lib/types/stock";
import { fetchJson } from "@/lib/utils/fetchJson";

export function useStockAnalysis(symbol: string | undefined) {
  return useQuery<StockAnalysisResponse>({
    queryKey: ["stock-analysis", symbol],
    queryFn: () => fetchJson(`/api/stock/${encodeURIComponent(symbol!)}`),
    enabled: Boolean(symbol),
    refetchInterval: 30_000,
  });
}
