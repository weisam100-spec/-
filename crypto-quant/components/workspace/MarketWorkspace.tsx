"use client";

import { useMemo, useState } from "react";
import { useKlines, useSymbols } from "@/lib/client/hooks";
import { CandlestickChart } from "@/components/charts/CandlestickChart";
import { RsiPanel } from "@/components/charts/RsiPanel";
import { MacdPanel } from "@/components/charts/MacdPanel";
import { TradingViewWidget } from "@/components/charts/TradingViewWidget";
import {
  LoadingState,
  ErrorState,
  EmptyState,
} from "@/components/common/StatusStates";
import { DataSourceBadge } from "@/components/common/DataSourceBadge";
import { SignalBadge } from "@/components/common/SignalBadge";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Select } from "@/components/ui/Field";
import { Tabs } from "@/components/ui/Tabs";
import {
  ema,
  macd as macdFn,
  rsi as rsiFn,
  bollinger,
  computeKeyLevels,
  computeTrendlines,
  computeOrderBlocks,
  computeFibonacciRetracement,
} from "@/lib/indicators";
import {
  strategyRegistry,
  requiresCorrelatedAsset,
  type StrategyId,
} from "@/lib/strategies/registry";
import {
  INTERVAL_LABEL,
  SUPPORTED_INTERVALS,
  type Interval,
} from "@/lib/market/symbols";
import { formatDateTime, formatUsdt, formatPercent } from "@/lib/format";

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
  const { data, isLoading, isError, error, refetch } = useKlines(
    symbol,
    interval,
    limit,
  );

  const candles = useMemo(() => data?.data ?? [], [data]);

  const indicators = useMemo(() => {
    if (candles.length === 0) return null;
    const closes = candles.map((c) => c.close);
    const emaShort = ema(closes, 20);
    const emaLong = ema(closes, 50);
    const rsiValues = rsiFn(closes, 14);
    const { macd: macdLine, signal, histogram } = macdFn(closes, 12, 26, 9);
    const { upper, lower } = bollinger(closes, 20, 2);
    return {
      emaShort,
      emaLong,
      rsiValues,
      macdLine,
      signal,
      histogram,
      upper,
      lower,
    };
  }, [candles]);

  const strategyNeedsCorrelatedAsset = requiresCorrelatedAsset(strategyId);

  const signals = useMemo(() => {
    if (candles.length === 0 || strategyNeedsCorrelatedAsset) return [];
    const strategy = strategyRegistry[strategyId];
    try {
      return strategy.generateSignals(
        candles,
        strategy.defaultParams as never,
        { symbol, interval },
      );
    } catch {
      return [];
    }
  }, [candles, strategyId, symbol, interval, strategyNeedsCorrelatedAsset]);

  const overlays = useMemo(() => {
    if (!indicators) return [];
    return [
      {
        name: "EMA20",
        color: "#3b82f6",
        data: candles.map((c, i) => ({
          time: c.openTime,
          value: indicators.emaShort[i]!,
        })),
      },
      {
        name: "EMA50",
        color: "#f2a900",
        data: candles.map((c, i) => ({
          time: c.openTime,
          value: indicators.emaLong[i]!,
        })),
      },
    ];
  }, [candles, indicators]);

  const keyLevels = useMemo(() => {
    if (candles.length === 0) return [];
    return computeKeyLevels(candles);
  }, [candles]);

  const trendlines = useMemo(() => {
    if (candles.length === 0) return { uptrend: null, downtrend: null };
    return computeTrendlines(candles);
  }, [candles]);

  const trendlineOverlays = useMemo(() => {
    const lines: {
      name: string;
      color: string;
      data: { time: number; value: number }[];
    }[] = [];
    if (trendlines.uptrend) {
      const t = trendlines.uptrend;
      lines.push({
        name: "上升趨勢線",
        color: "#16c784",
        data: [
          { time: t.startTime, value: t.startPrice },
          { time: t.endTime, value: t.endPrice },
        ],
      });
    }
    if (trendlines.downtrend) {
      const t = trendlines.downtrend;
      lines.push({
        name: "下降趨勢線",
        color: "#ea3943",
        data: [
          { time: t.startTime, value: t.startPrice },
          { time: t.endTime, value: t.endPrice },
        ],
      });
    }
    return lines;
  }, [trendlines]);

  const orderBlocks = useMemo(() => {
    if (candles.length === 0) return [];
    return computeOrderBlocks(candles);
  }, [candles]);

  const orderBlockOverlays = useMemo(() => {
    const lines: {
      name: string;
      color: string;
      data: { time: number; value: number }[];
    }[] = [];
    for (const ob of orderBlocks) {
      const color = ob.type === "bullish" ? "#16c784" : "#ea3943";
      const name = `${ob.type === "bullish" ? "多頭" : "空頭"}訂單塊`;
      // 以上下兩條邊界線＋左右兩條邊界線畫出區塊的矩形外框
      lines.push(
        {
          name,
          color,
          data: [
            { time: ob.startTime, value: ob.high },
            { time: ob.endTime, value: ob.high },
          ],
        },
        {
          name,
          color,
          data: [
            { time: ob.startTime, value: ob.low },
            { time: ob.endTime, value: ob.low },
          ],
        },
        {
          name,
          color,
          data: [
            { time: ob.startTime, value: ob.low },
            { time: ob.startTime, value: ob.high },
          ],
        },
        {
          name,
          color,
          data: [
            { time: ob.endTime, value: ob.low },
            { time: ob.endTime, value: ob.high },
          ],
        },
      );
    }
    return lines;
  }, [orderBlocks]);

  const fibonacci = useMemo(() => {
    if (candles.length === 0) return null;
    return computeFibonacciRetracement(candles);
  }, [candles]);

  const priceLines = useMemo(() => {
    const keyLevelLines = keyLevels.map((l) => ({
      price: l.price,
      color: l.type === "resistance" ? "#ea3943" : "#16c784",
      title: `${l.type === "resistance" ? "壓力" : "支撐"} ${formatUsdt(l.price, { decimals: 2 })}`,
    }));
    const fibLines = (fibonacci?.levels ?? []).map((l) => ({
      price: l.price,
      color: "#c9a227",
      title: `Fib ${l.label} ${formatUsdt(l.price, { decimals: 2 })}`,
    }));
    return [...keyLevelLines, ...fibLines];
  }, [keyLevels, fibonacci]);

  const rsiSeries = useMemo(
    () =>
      indicators
        ? candles.map((c, i) => ({
            time: c.openTime,
            value: indicators.rsiValues[i]!,
          }))
        : [],
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
            <Select
              value={interval}
              onChange={(e) => setInterval(e.target.value as Interval)}
            >
              {SUPPORTED_INTERVALS.map((iv) => (
                <option key={iv} value={iv}>
                  {INTERVAL_LABEL[iv]}
                </option>
              ))}
            </Select>
            <Select
              value={strategyId}
              onChange={(e) => setStrategyId(e.target.value as StrategyId)}
            >
              {Object.values(strategyRegistry).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <label className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
              <input
                type="checkbox"
                checked={showSignals}
                onChange={(e) => setShowSignals(e.target.checked)}
              />
              在圖表上顯示訊號標記
            </label>
          </div>
        </Card>
      )}

      <Card>
        {compact && (
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="!py-1 text-xs"
              >
                {(symbolsData?.symbols ?? []).map((s) => (
                  <option key={s.symbol} value={s.symbol}>
                    {s.displayName}
                  </option>
                ))}
              </Select>
              <Select
                value={interval}
                onChange={(e) => setInterval(e.target.value as Interval)}
                className="!py-1 text-xs"
              >
                {SUPPORTED_INTERVALS.map((iv) => (
                  <option key={iv} value={iv}>
                    {INTERVAL_LABEL[iv]}
                  </option>
                ))}
              </Select>
            </div>
            {data && (
              <DataSourceBadge
                freshness={data.freshness}
                fetchedAt={data.fetchedAt}
              />
            )}
          </CardHeader>
        )}
        {!compact && (
          <CardHeader>
            <CardTitle>
              {symbol} · {INTERVAL_LABEL[interval]} K 線圖
            </CardTitle>
            {data && (
              <DataSourceBadge
                freshness={data.freshness}
                fetchedAt={data.fetchedAt}
              />
            )}
          </CardHeader>
        )}

        {isLoading && <LoadingState label="正在載入行情資料…" />}
        {isError && (
          <ErrorState
            message={
              error instanceof Error ? error.message : "載入行情資料失敗"
            }
            onRetry={() => refetch()}
          />
        )}
        {!isLoading && !isError && data?.unavailable && (
          <EmptyState
            message="目前無法取得資料"
            hint={data.unavailable.reason}
          />
        )}
        {!isLoading &&
          !isError &&
          !data?.unavailable &&
          candles.length === 0 && <EmptyState message="所選區間內查無資料" />}
        {!isLoading && !isError && candles.length > 0 && compact && (
          <CandlestickChart
            candles={candles}
            overlays={overlays}
            signals={showSignals ? signals : []}
            height={260}
          />
        )}
        {!isLoading && !isError && candles.length > 0 && !compact && (
          <Tabs
            tabs={[
              {
                id: "own",
                label: "本站圖表（含策略訊號）",
                content: (
                  <>
                    <CandlestickChart
                      candles={candles}
                      overlays={[
                        ...overlays,
                        ...trendlineOverlays,
                        ...orderBlockOverlays,
                      ]}
                      signals={showSignals ? signals : []}
                      priceLines={priceLines}
                      height={360}
                    />
                    <div className="mt-2 space-y-2">
                      <RsiPanel data={rsiSeries} />
                      <MacdPanel data={macdSeries} />
                    </div>
                  </>
                ),
              },
              {
                id: "tradingview",
                label: "TradingView 圖表",
                content: (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-[var(--color-text-muted)]">
                      此圖表由 TradingView 官方 Widget 提供（
                      {symbol.replace("USDT", "")}
                      /USDT，幣安現貨），僅供對照參考；資料來源與更新時間可能與本站策略分析所用資料略有差異，不會顯示本站策略訊號。
                    </p>
                    <TradingViewWidget
                      symbol={symbol}
                      interval={interval}
                      height={540}
                    />
                  </div>
                ),
              },
            ]}
          />
        )}
      </Card>

      <div className="flex flex-col gap-4">
        {!compact && (
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>關鍵價位（支撐／壓力）</CardTitle>
            </CardHeader>
            <p className="mb-2 text-xs text-[var(--color-text-muted)]">
              依歷史擺動高/低點聚合而成，觸及次數越多代表該價位歷史上越常被市場認可，純屬統計結果，不是預測也不保證價格到了就會反轉或突破。
            </p>
            {keyLevels.length === 0 ? (
              <EmptyState message="資料量不足，暫無法判斷關鍵價位" />
            ) : (
              <ul className="flex flex-col gap-1">
                {keyLevels.map((l, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded-md border border-[var(--color-border)] px-2 py-1 text-xs"
                  >
                    <span className={l.type === "resistance" ? "neg" : "pos"}>
                      {l.type === "resistance" ? "壓力" : "支撐"}
                    </span>
                    <span className="font-medium text-[var(--color-text)]">
                      {formatUsdt(l.price, { decimals: 2 })}
                    </span>
                    <span className="text-[var(--color-text-muted)]">
                      {formatPercent(l.distancePct)}
                    </span>
                    <span className="text-[var(--color-text-muted)]">
                      {l.strength === "strong"
                        ? "強"
                        : l.strength === "medium"
                          ? "中"
                          : "弱"}
                      （{l.touchCount} 次）
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {!compact && (
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>趨勢線</CardTitle>
            </CardHeader>
            <p className="mb-2 text-xs text-[var(--color-text-muted)]">
              連接尚未被跌破的擺動低點／尚未被站上的擺動高點畫出的直線，純屬歷史價格結構的幾何描繪，不是預測，價格隨時可能突破或跌破。
            </p>
            {!trendlines.uptrend && !trendlines.downtrend ? (
              <EmptyState message="目前沒有偵測到有效的上升或下降趨勢線" />
            ) : (
              <ul className="flex flex-col gap-1">
                {trendlines.uptrend && (
                  <li className="flex items-center justify-between rounded-md border border-[var(--color-border)] px-2 py-1 text-xs">
                    <span className="pos">上升趨勢線</span>
                    <span className="text-[var(--color-text-muted)]">
                      {formatUsdt(trendlines.uptrend.startPrice, {
                        decimals: 2,
                      })}{" "}
                      →{" "}
                      {formatUsdt(trendlines.uptrend.endPrice, { decimals: 2 })}
                    </span>
                    <span className="text-[var(--color-text-muted)]">
                      {trendlines.uptrend.strength === "strong"
                        ? "強"
                        : trendlines.uptrend.strength === "medium"
                          ? "中"
                          : "弱"}
                      （{trendlines.uptrend.touchCount} 點）
                    </span>
                  </li>
                )}
                {trendlines.downtrend && (
                  <li className="flex items-center justify-between rounded-md border border-[var(--color-border)] px-2 py-1 text-xs">
                    <span className="neg">下降趨勢線</span>
                    <span className="text-[var(--color-text-muted)]">
                      {formatUsdt(trendlines.downtrend.startPrice, {
                        decimals: 2,
                      })}{" "}
                      →{" "}
                      {formatUsdt(trendlines.downtrend.endPrice, {
                        decimals: 2,
                      })}
                    </span>
                    <span className="text-[var(--color-text-muted)]">
                      {trendlines.downtrend.strength === "strong"
                        ? "強"
                        : trendlines.downtrend.strength === "medium"
                          ? "中"
                          : "弱"}
                      （{trendlines.downtrend.touchCount} 點）
                    </span>
                  </li>
                )}
              </ul>
            )}
          </Card>
        )}

        {!compact && (
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>訂單塊</CardTitle>
            </CardHeader>
            <p className="mb-2 text-xs text-[var(--color-text-muted)]">
              結構突破當下，帶動突破的那根 K 棒之前最後一根反方向 K
              棒的高低區間（SMC
              策略同一套規則），只列出目前仍未被價格回測、也還沒超過有效期的區塊，純屬歷史價格結構標示，不是訊號也不是預測。
            </p>
            {orderBlocks.length === 0 ? (
              <EmptyState message="目前沒有偵測到仍然有效的訂單塊" />
            ) : (
              <ul className="flex flex-col gap-1">
                {orderBlocks.map((ob, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded-md border border-[var(--color-border)] px-2 py-1 text-xs"
                  >
                    <span className={ob.type === "bullish" ? "pos" : "neg"}>
                      {ob.type === "bullish" ? "多頭" : "空頭"}訂單塊
                    </span>
                    <span className="text-[var(--color-text-muted)]">
                      {formatUsdt(ob.low, { decimals: 2 })} ~{" "}
                      {formatUsdt(ob.high, { decimals: 2 })}
                    </span>
                    <span className="text-[var(--color-text-muted)]">
                      {ob.isChoch ? "CHoCH" : "BOS"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {!compact && (
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>斐波那契回檔</CardTitle>
            </CardHeader>
            <p className="mb-2 text-xs text-[var(--color-text-muted)]">
              依近期視窗內的最高點與最低點，以標準比例（23.6% / 38.2% / 50% /
              61.8% /
              78.6%）切出水平線，純屬幾何計算，不是預測，也不保證價格會在這些價位反應。
            </p>
            {!fibonacci ? (
              <EmptyState message="資料量不足，暫無法計算" />
            ) : (
              <>
                <p className="mb-2 text-xs text-[var(--color-text-muted)]">
                  {fibonacci.direction === "retracement_down"
                    ? "近期走勢偏多頭，測量拉回支撐"
                    : "近期走勢偏空頭，測量反彈壓力"}
                  ： {formatUsdt(fibonacci.anchorLowPrice, { decimals: 2 })} ~{" "}
                  {formatUsdt(fibonacci.anchorHighPrice, { decimals: 2 })}
                </p>
                <ul className="flex flex-col gap-1">
                  {fibonacci.levels.map((l, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between rounded-md border border-[var(--color-border)] px-2 py-1 text-xs"
                    >
                      <span className="text-[#c9a227]">{l.label}</span>
                      <span className="font-medium text-[var(--color-text)]">
                        {formatUsdt(l.price, { decimals: 2 })}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>最新策略訊號</CardTitle>
          </CardHeader>
          {strategyNeedsCorrelatedAsset ? (
            <EmptyState
              message="此策略需同時比較兩個交易對，行情頁即時預覽不支援"
              hint="請至「策略設定頁」設定比較交易對後執行回測，即可看到完整訊號"
            />
          ) : recentSignals.length === 0 ? (
            <EmptyState
              message="目前沒有符合條件的訊號"
              hint="調整策略或週期後再試"
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {recentSignals.map((s, i) => (
                <li
                  key={`${s.time}-${i}`}
                  className="rounded-md border border-[var(--color-border)] p-2"
                >
                  <button
                    className="flex w-full items-center justify-between gap-2 text-left"
                    onClick={() =>
                      setExpandedSignal(expandedSignal === i ? null : i)
                    }
                  >
                    <div className="flex flex-col gap-1">
                      <SignalBadge type={s.type} />
                      <span className="text-[11px] text-[var(--color-text-muted)]">
                        {formatDateTime(s.time)} · {formatUsdt(s.price)}
                      </span>
                    </div>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      信心 {s.confidence}
                    </span>
                  </button>
                  {expandedSignal === i && (
                    <div className="mt-2 border-t border-[var(--color-border)] pt-2 text-xs text-[var(--color-text-muted)]">
                      <p>{s.reason}</p>
                      {s.contributions && (
                        <ul className="mt-1 space-y-0.5">
                          {s.contributions.map((c) => (
                            <li key={c.factor} className="flex justify-between">
                              <span>{c.factor}</span>
                              <span
                                className={c.contribution >= 0 ? "pos" : "neg"}
                              >
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
    </div>
  );
}
