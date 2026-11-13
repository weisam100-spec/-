import { fetchKlinesRange, type KlinesRangeResult } from "./klinesRange";
import { requiresCorrelatedAsset, requiresHigherTimeframe, type StrategyId } from "@/lib/strategies/registry";
import { HIGHER_TIMEFRAME } from "@/lib/strategies/higherTimeframe";
import { INTERVAL_MS, type Interval } from "./symbols";

export interface StrategyCandlesResult {
  primary: KlinesRangeResult;
  /** 僅在策略需要跨資產比較（例如 SMT）時才會有值 */
  correlated?: KlinesRangeResult;
  /** 僅在策略需要多時間框架順勢過濾時才會有值 */
  higherTimeframe?: KlinesRangeResult;
}

/**
 * 只抓比較交易對那一份資料（不含主要交易對），
 * 供已經持有主要交易對資料的呼叫端（例如策略比較頁，多個策略共用同一份主要資料）使用。
 * 不需要跨資產比較的策略會回傳 undefined；比較交易對資料無法取得時，
 * 一律明確回報原因，不會用主要交易對的資料頂替。
 */
export async function fetchCorrelatedCandles(params: {
  strategyId: StrategyId;
  symbol: string;
  interval: Interval;
  strategyParams: Record<string, unknown>;
  startTime: number;
  endTime: number;
  maxBars: number;
}): Promise<KlinesRangeResult | undefined> {
  if (!requiresCorrelatedAsset(params.strategyId)) return undefined;

  const correlatedSymbol = params.strategyParams.correlatedSymbol;
  if (typeof correlatedSymbol !== "string" || !correlatedSymbol) {
    return {
      candles: [],
      source: "binance",
      freshness: "historical",
      unavailable: { reason: "策略參數缺少比較交易對（correlatedSymbol）" },
    };
  }
  if (correlatedSymbol === params.symbol) {
    return {
      candles: [],
      source: "binance",
      freshness: "historical",
      unavailable: { reason: "比較交易對不可與主要交易對相同" },
    };
  }

  return fetchKlinesRange({
    symbol: correlatedSymbol,
    interval: params.interval,
    startTime: params.startTime,
    endTime: params.endTime,
    maxBars: params.maxBars,
  });
}

/**
 * 只抓高一層時間週期那一份資料（供多時間框架順勢過濾使用），不需要此功能的策略會回傳 undefined；
 * 主要週期已是最高支援週期（日線）時明確回報「沒有更高週期」，不會用主要週期的資料頂替。
 */
export async function fetchHigherTimeframeCandles(params: {
  strategyId: StrategyId;
  symbol: string;
  interval: Interval;
  startTime: number;
  endTime: number;
  maxBars: number;
}): Promise<KlinesRangeResult | undefined> {
  if (!requiresHigherTimeframe(params.strategyId)) return undefined;

  const higherInterval = HIGHER_TIMEFRAME[params.interval];
  if (higherInterval === null) {
    return {
      candles: [],
      source: "binance",
      freshness: "historical",
      unavailable: { reason: `${params.interval} 已是最高支援週期，沒有更高層週期可用於順勢過濾` },
    };
  }

  // 往前多抓一段資料，讓高週期的市場結構判斷在回測區間一開始就有足夠的擺動點可用，
  // 不會因為結構尚未明朗（unknown）而把區間前段的訊號都保守濾掉。
  const warmupMs = 100 * INTERVAL_MS[higherInterval];
  return fetchKlinesRange({
    symbol: params.symbol,
    interval: higherInterval,
    startTime: params.startTime - warmupMs,
    endTime: params.endTime,
    maxBars: params.maxBars,
  });
}

/**
 * 依策略需求抓取回測所需的 K 線資料：一般策略只抓主要交易對；
 * 需要跨資產比較的策略（如 SMT 背離）會再抓一組比較交易對的同週期 K 線；
 * 需要多時間框架順勢過濾的策略會再抓一組高一層週期的同交易對 K 線。
 */
export async function fetchStrategyCandles(params: {
  strategyId: StrategyId;
  symbol: string;
  interval: Interval;
  strategyParams: Record<string, unknown>;
  startTime: number;
  endTime: number;
  maxBars: number;
}): Promise<StrategyCandlesResult> {
  const primary = await fetchKlinesRange({
    symbol: params.symbol,
    interval: params.interval,
    startTime: params.startTime,
    endTime: params.endTime,
    maxBars: params.maxBars,
  });

  const correlated = await fetchCorrelatedCandles(params);
  const higherTimeframe = await fetchHigherTimeframeCandles(params);
  return { primary, correlated, higherTimeframe };
}
