"use client";

import { useQuery } from "@tanstack/react-query";
import type { StockQuote } from "@/lib/types/stock";
import { fetchJson } from "@/lib/utils/fetchJson";

export function useHotStocks(limit = 5) {
  return useQuery<StockQuote[]>({
    queryKey: ["hot-stocks", limit],
    queryFn: () => fetchJson(`/api/market/hot?limit=${limit}`),
    refetchInterval: 60_000,
  });
}
