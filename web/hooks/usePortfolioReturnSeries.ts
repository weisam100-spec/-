"use client";

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import type { HoldingItem, OhlcvBar } from "@/lib/types/stock";
import { fetchJson } from "@/lib/utils/fetchJson";
import { computePortfolioReturnSeries, pickRangeCovering } from "@/services/analysis/portfolio";

export function usePortfolioReturnSeries(holdings: HoldingItem[]) {
  const queries = useQueries({
    queries: holdings.map((h) => {
      const range = pickRangeCovering(h.purchaseDate);
      return {
        queryKey: ["portfolio-history", h.symbol, range],
        queryFn: () =>
          fetchJson<OhlcvBar[]>(
            `/api/stock/${encodeURIComponent(h.symbol)}/history?interval=D&range=${range}`
          ),
      };
    }),
  });

  const isLoading = holdings.length > 0 && queries.some((q) => q.isLoading);
  const isError = queries.some((q) => q.isError);
  const allLoaded = holdings.length > 0 && queries.every((q) => q.data);

  const series = useMemo(() => {
    if (!allLoaded) return [];
    const historiesBySymbol: Record<string, OhlcvBar[]> = {};
    holdings.forEach((h, i) => {
      historiesBySymbol[h.symbol] = (queries[i].data as OhlcvBar[]) ?? [];
    });
    return computePortfolioReturnSeries(holdings, historiesBySymbol);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allLoaded, holdings]);

  return { series, isLoading, isError };
}
