"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost } from "./api";
import type { SymbolMeta, Interval } from "@/lib/market/symbols";
import type { Candle, ProviderResult, Ticker24h } from "@/lib/market/types";
import type { FxRate } from "@/lib/market/fx";
import type { StrategyId } from "@/lib/strategies/registry";
import type { BacktestConfig, EquityPoint, TradeRecord } from "@/lib/backtest/types";
import type { PerformanceMetrics } from "@/lib/backtest/metrics";
import type { StrategyConfigRecord } from "@/lib/storage/strategyConfigRepo";
import type { WatchlistItem } from "@/lib/storage/watchlistRepo";
import type { PortfolioSnapshot } from "@/lib/storage/portfolioRepo";

export function useSymbols() {
  return useQuery({
    queryKey: ["symbols"],
    queryFn: () => apiGet<{ symbols: SymbolMeta[]; intervals: { id: Interval; label: string }[] }>("/api/symbols"),
    staleTime: Infinity,
  });
}

export function useStrategyList() {
  return useQuery({
    queryKey: ["strategies"],
    queryFn: () =>
      apiGet<{ strategies: { id: StrategyId; name: string; description: string; defaultParams: Record<string, unknown> }[] }>(
        "/api/strategies",
      ),
    staleTime: Infinity,
  });
}

export function useTicker(symbol: string, options?: { refetchIntervalMs?: number }) {
  return useQuery({
    queryKey: ["ticker", symbol],
    queryFn: () => apiGet<ProviderResult<Ticker24h>>(`/api/market/ticker?symbol=${symbol}`),
    refetchInterval: options?.refetchIntervalMs ?? 20_000,
  });
}

export function useKlines(symbol: string, interval: Interval, limit = 500) {
  return useQuery({
    queryKey: ["klines", symbol, interval, limit],
    queryFn: () => apiGet<ProviderResult<Candle[]>>(`/api/market/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`),
    refetchInterval: 60_000,
  });
}

export function useFxRate() {
  return useQuery({ queryKey: ["fx"], queryFn: () => apiGet<FxRate>("/api/fx"), staleTime: 60_000 });
}

export interface BacktestRunResponse {
  dataSource: "binance" | "demo";
  freshness: string;
  elapsedMs: number;
  signalCount: number;
  config: BacktestConfig;
  warnings: { code: string; message: string }[];
  metrics: PerformanceMetrics;
  equityCurve: EquityPoint[];
  trades: TradeRecord[];
  usedCandles: number;
}

export function useRunBacktest() {
  return useMutation({
    mutationFn: (payload: {
      symbol: string;
      interval: Interval;
      strategyId: StrategyId;
      strategyParams: Record<string, unknown>;
      config: BacktestConfig;
    }) => apiPost<BacktestRunResponse>("/api/backtest/run", payload),
  });
}

export interface CompareEntry {
  strategyId: StrategyId;
  label: string;
  ok: boolean;
  metrics?: PerformanceMetrics;
  warnings?: { code: string; message: string }[];
  error?: string;
}

export function useRunCompare() {
  return useMutation({
    mutationFn: (payload: {
      symbol: string;
      interval: Interval;
      config: BacktestConfig;
      strategies: { strategyId: StrategyId; strategyParams: Record<string, unknown>; label?: string }[];
    }) =>
      apiPost<{ dataSource: string; freshness: string; usedCandles: number; comparisons: CompareEntry[]; disclaimer: string }>(
        "/api/backtest/compare",
        payload,
      ),
  });
}

export function useRunSensitivity() {
  return useMutation({
    mutationFn: (payload: unknown) => apiPost<{ cells: { xValue: number; yValue: number; metricValue: number | null; tradeCount: number }[]; warnings: string[] }>("/api/backtest/sensitivity", payload),
  });
}

export function useRunWalkForward() {
  return useMutation({
    mutationFn: (payload: unknown) =>
      apiPost<{
        folds: {
          foldIndex: number;
          trainStart: number;
          trainEnd: number;
          testStart: number;
          testEnd: number;
          bestParams: Record<string, unknown>;
          trainMetricValue: number | null;
          testMetrics: PerformanceMetrics;
        }[];
        warnings: string[];
        disclaimer: string;
      }>("/api/backtest/walkforward", payload),
  });
}

export function useStrategyConfigs() {
  return useQuery({
    queryKey: ["strategy-configs"],
    queryFn: () => apiGet<{ configs: StrategyConfigRecord[] }>("/api/strategy-configs"),
  });
}

export function useCreateStrategyConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: unknown) => apiPost<{ config: StrategyConfigRecord }>("/api/strategy-configs", payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["strategy-configs"] }),
  });
}

export function useUpdateStrategyConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: unknown }) =>
      apiPatch<{ config: StrategyConfigRecord }>(`/api/strategy-configs/${id}`, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["strategy-configs"] }),
  });
}

export function useDeleteStrategyConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ deleted: boolean }>(`/api/strategy-configs/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["strategy-configs"] }),
  });
}

export function useDuplicateStrategyConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<{ config: StrategyConfigRecord }>(`/api/strategy-configs/${id}/duplicate`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["strategy-configs"] }),
  });
}

export function useWatchlist() {
  return useQuery({ queryKey: ["watchlist"], queryFn: () => apiGet<{ items: WatchlistItem[] }>("/api/watchlist") });
}

export function useAddWatchlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { symbol: string; note?: string }) => apiPost<{ item: WatchlistItem }>("/api/watchlist", payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist"] }),
  });
}

export function useRemoveWatchlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ deleted: boolean }>(`/api/watchlist/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist"] }),
  });
}

export function usePortfolio() {
  return useQuery({ queryKey: ["portfolio"], queryFn: () => apiGet<{ portfolio: PortfolioSnapshot }>("/api/portfolio") });
}

export function useResetPortfolio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (initialCashUsdt?: number) => apiPost<{ portfolio: PortfolioSnapshot }>("/api/portfolio", { initialCashUsdt }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portfolio"] }),
  });
}

export function usePaperTrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { symbol: string; side: "buy" | "sell"; quantity: number; priceUsdt: number }) =>
      apiPost<{ portfolio: PortfolioSnapshot }>("/api/portfolio/trade", payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portfolio"] }),
  });
}
