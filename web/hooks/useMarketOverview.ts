"use client";

import { useQuery } from "@tanstack/react-query";
import type { MarketOverview } from "@/lib/types/stock";
import { fetchJson } from "@/lib/utils/fetchJson";

export function useMarketOverview() {
  return useQuery<MarketOverview>({
    queryKey: ["market-overview"],
    queryFn: () => fetchJson("/api/market/overview"),
    refetchInterval: 60_000,
  });
}
