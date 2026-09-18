"use client";

import { useMemo, useState } from "react";
import { useKlines, useSymbols } from "@/lib/client/hooks";
import { CandlestickChart } from "@/components/charts/CandlestickChart";
import { RsiPanel } from "@/components/charts/RsiPanel";
import { MacdPanel } from "@/components/charts/MacdPanel";
import { LoadingState, ErrorState, EmptyState } from "@/components/common/StatusStates";
import { DataSourceBadge } from "@/components/common/DataSourceBadge";
import { SignalBadge } from "@/components/common/SignalBadge";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Select } from "@/components/ui/Field";
import { ema, macd as macdFn, rsi as rsiFn, bollinger } from "@/lib/indicators";
import { strategyRegistry, type StrategyId } from "@/lib/strategies/registry";
import { INTERVAL_LABEL, SUPPORTED_INTERVALS, type Interval } from "@/lib/market/symbols";
import { formatDateTime, formatUsdt } from "@/lib/format";

export function MarketWorkspace({
  compact = false,
  initialSymbol = "BTCUSDT",
}: {
  compact?: boolean;
  initialSymbol?: string;
}) {
  const { data: symbolsData } = useSymbols();
  const [symbol, setSymbol] = useState(initialSymbol);
  const [interval, setInterval] = useState<Interval>("1h");
  const [strategyId, setStrategyId] = useState<StrategyId>("ema-trend");
  const [showSignals, setShowSignals] = useState(true);
  const [expandedSignal, setExpandedSignal] = useState<number | null>(null);

  const limit = compact ? 200 : 500;
  const { data, isLoading, isError, error, refetch } = useKlines(symbol, interval, limit);

  const candles = useMemo(() => data?.data ?? [], [data]);

  const indicators = useMemo(() => {
    if (candles.length === 0) return null;
    const closes = candles.map((c) => c.close);
    const emaShort = ema(closes, 20);
    const emaLong = ema(closes, 50);
    const rsiValues = rsiFn(closes, 14);
    const { macd: macdLine, signal, histogram } = macdFn(closes, 12, 26, 9);
    const { upper, lower } = bollinger(closes, 20, 2);
    return { emaShort, emaLong, rsiValues, macdLine, signal, histogram, upper, lower };
  }, [candles]);

  const signals = useMemo(() => {
    if (candles.length === 0) return [];
    const strategy = strategyRegistry[strategyId];
    try {
      return strategy.generateSignals(candles, strategy.defaultParams as never, { symbol, interval });
    } catch {
      return [];
    }
  }, [candles, strategyId, symbol, interval]);

  const overlays = useMemo(() => {
    if (!indicators) return [];
    return [
      { name: "EMA20", color: "#3b82f6", data: candles.map((c, i) => ({ time: c.openTime, value: indicators.emaShort[i]! })) },
      { name: "EMA50", color: "#f2a900", data: candles.map((c, i) => ({ time: c.openTime, value: indicators.emaLong[i]! })) },
    ];
  }, [candles, indicators]);

  const rsiSeries = useMemo(
    () => (indicators ? candles.map((c, i) => ({ time: c.openTime, value: indicators.rsiValues[i]! })) : []),
    [candles, indicators],
  );
  const macdSeries = useMemo(
    () =>
      indicators
        ? candles.map((c, i) => ({
            time: c.openTime,
            macd: indicators.macdLine[i]!,
            signal: indicators.signal[i]!,
            histogram: indicators.histogram[i]!,
          }))
        : [],
    [candles, indicators],
  );

  const recentSignals = [...signals].reverse().slice(0, compact ? 4 : 15);

  return (
    <div className={compact ? "" : "grid gap-4 lg:grid-cols-[220px_1fr_320px]"}>
      {!compact && (
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>設定</CardTitle>
          </CardHeader>
          <div className="flex flex-col gap-3">
            <Select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
              {(symbolsData?.symbols ?? []).map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.displayName}
                </option>
              ))}
            </Select>
            <Select value={interval} onChange={(e) => setInterval(e.target.value as Interval)}>
              {SUPPORTED_INTERVALS.map((iv) => (
                <option key={iv} value={iv}>
                  {INTERVAL_LABEL[iv]}
                </option>
              ))}
            </Select>
            <Select value={strategyId} onChange={(e) => setStrategyId(e.target.value as StrategyId)}>
              {Object.values(strategyRegistry).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <label className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
              <input type="checkbox" checked={showSignals} onChange={(e) => setShowSignals(e.target.checked)} />
              在圖表上顯示訊號標記
            </label>
          </div>
        </Card>
      )}

      <Card>
        {compact && (
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={symbol} onChange={(e) => setSymbol(e.target.value)} className="!py-1 text-xs">
                {(symbolsData?.symbols ?? []).map((s) => (
                  <option key={s.symbol} value={s.symbol}>
                    {s.displayName}
                  </option>
                ))}
              </Select>
              <Select value={interval} onChange={(e) => setInterval(e.target.value as Interval)} className="!py-1 text-xs">
                {SUPPORTED_INTERVALS.map((iv) => (
                  <option key={iv} value={iv}>
                    {INTERVAL_LABEL[iv]}
                  </option>
                ))}
              </Select>
            </div>
            {data && <DataSourceBadge freshness={data.freshness} fetchedAt={data.fetchedAt} />}
          </CardHeader>
        )}
        {!compact && (
          <CardHeader>
            <CardTitle>
              {symbol} · {INTERVAL_LABEL[interval]} K 線圖
            </CardTitle>
            {data && <DataSourceBadge freshness={data.freshness} fetchedAt={data.fetchedAt} />}
          </CardHeader>
        )}

        {isLoading && <LoadingState label="正在載入行情資料…" />}
        {isError && <ErrorState message={error instanceof Error ? error.message : "載入行情資料失敗"} onRetry={() => refetch()} />}
        {!isLoading && !isError && data?.unavailable && (
          <EmptyState message="目前無法取得資料" hint={data.unavailable.reason} />
        )}
        {!isLoading && !isError && !data?.unavailable && candles.length === 0 && (
          <EmptyState message="所選區間內查無資料" />
        )}
        {!isLoading && !isError && candles.length > 0 && (
          <>
            <CandlestickChart candles={candles} overlays={overlays} signals={showSignals ? signals : []} height={compact ? 260 : 360} />
            {!compact && (
              <div className="mt-2 space-y-2">
                <RsiPanel data={rsiSeries} />
                <MacdPanel data={macdSeries} />
              </div>
            )}
          </>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>最新策略訊號</CardTitle>
        </CardHeader>
        {recentSignals.length === 0 ? (
          <EmptyState message="目前沒有符合條件的訊號" hint="調整策略或週期後再試" />
        ) : (
          <ul className="flex flex-col gap-2">
            {recentSignals.map((s, i) => (
              <li key={`${s.time}-${i}`} className="rounded-md border border-[var(--color-border)] p-2">
                <button
                  className="flex w-full items-center justify-between gap-2 text-left"
                  onClick={() => setExpandedSignal(expandedSignal === i ? null : i)}
                >
                  <div className="flex flex-col gap-1">
                    <SignalBadge type={s.type} />
                    <span className="text-[11px] text-[var(--color-text-muted)]">
                      {formatDateTime(s.time)} · {formatUsdt(s.price)}
                    </span>
                  </div>
                  <span className="text-xs text-[var(--color-text-muted)]">信心 {s.confidence}</span>
                </button>
                {expandedSignal === i && (
                  <div className="mt-2 border-t border-[var(--color-border)] pt-2 text-xs text-[var(--color-text-muted)]">
                    <p>{s.reason}</p>
                    {s.contributions && (
                      <ul className="mt-1 space-y-0.5">
                        {s.contributions.map((c) => (
                          <li key={c.factor} className="flex justify-between">
                            <span>{c.factor}</span>
                            <span className={c.contribution >= 0 ? "pos" : "neg"}>
                              {c.contribution >= 0 ? "+" : ""}
                              {c.contribution}（{c.detail}）
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
