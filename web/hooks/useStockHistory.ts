"use client";

import { useQuery } from "@tanstack/react-query";
import type { KLineInterval, KLineRange, OhlcvBar } from "@/lib/types/stock";
import { fetchJson } from "@/lib/utils/fetchJson";

export function useStockHistory(
  symbol: string | undefined,
  interval: KLineInterval,
  range: KLineRange
) {
  return useQuery<OhlcvBar[]>({
    queryKey: ["stock-history", symbol, interval, range],
    queryFn: () =>
      fetchJson(
        `/api/stock/${encodeURIComponent(symbol!)}/history?interval=${interval}&range=${range}`
      ),
    enabled: Boolean(symbol),
  });
}
