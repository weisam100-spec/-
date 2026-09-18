import { getActiveProvider } from "./providers";
import { INTERVAL_MS, type Interval } from "./symbols";
import type { Candle, DataFreshness } from "./types";

export interface KlinesRangeResult {
  candles: Candle[];
  source: "binance" | "demo";
  freshness: DataFreshness;
  unavailable?: { reason: string };
}

/**
 * Binance 單次請求最多回傳 1000 根 K 棒，回測可能需要更長區間，
 * 此函式以游標分頁串接多次請求，並限制總筆數與請求次數避免失控。
 */
export async function fetchKlinesRange(params: {
  symbol: string;
  interval: Interval;
  startTime: number;
  endTime: number;
  maxBars: number;
}): Promise<KlinesRangeResult> {
  const provider = getActiveProvider();
  const stepMs = INTERVAL_MS[params.interval];
  const maxPages = Math.min(50, Math.ceil(params.maxBars / 1000) + 2);

  let cursor = params.startTime;
  const all: Candle[] = [];
  let freshness: DataFreshness = "historical";

  for (let page = 0; page < maxPages; page++) {
    if (cursor > params.endTime || all.length >= params.maxBars) break;
    const result = await provider.getKlines({
      symbol: params.symbol,
      interval: params.interval,
      startTime: cursor,
      endTime: params.endTime,
      limit: 1000,
    });
    if (result.unavailable) {
      return { candles: [], source: result.source, freshness: result.freshness, unavailable: result.unavailable };
    }
    freshness = result.freshness;
    const batch = result.data;
    if (batch.length === 0) break;
    all.push(...batch);
    const last = batch[batch.length - 1]!;
    if (batch.length < 1000) break;
    cursor = last.openTime + stepMs;
  }

  return { candles: all.slice(0, params.maxBars), source: provider.id, freshness };
}
