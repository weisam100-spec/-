import { env } from "@/lib/env";
import { fetchWithRetry, UpstreamFetchError } from "@/lib/market/fetchWithRetry";
import { isSupportedSymbol } from "@/lib/market/symbols";
import type {
  Candle,
  DataProvider,
  KlinesQuery,
  ProviderResult,
  Ticker24h,
} from "@/lib/market/types";

// Binance 現貨公開市場資料 K 棒欄位順序
// [開盤時間, 開, 高, 低, 收, 量, 收盤時間, 報價量, 成交筆數, 主動買入量, 主動買入報價量, 忽略]
type BinanceKline = [number, string, string, string, string, string, number, string, number, string, string, string];

interface Binance24hrTicker {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  volume: string;
  quoteVolume: string;
  highPrice: string;
  lowPrice: string;
}

function toCandle(row: BinanceKline, nowMs: number): Candle {
  const [openTime, open, high, low, close, volume, closeTime] = row;
  return {
    openTime,
    open: Number(open),
    high: Number(high),
    low: Number(low),
    close: Number(close),
    volume: Number(volume),
    closed: closeTime <= nowMs,
  };
}

async function checkSymbolExists(symbol: string): Promise<boolean> {
  try {
    const res = await fetchWithRetry(
      `${env.binanceBaseUrl}/api/v3/exchangeInfo?symbol=${encodeURIComponent(symbol)}`,
      undefined,
      { maxRetries: 1, timeoutMs: 5000 },
    );
    const data = (await res.json()) as { symbols?: unknown[] };
    return Array.isArray(data.symbols) && data.symbols.length > 0;
  } catch {
    return false;
  }
}

export class BinanceProvider implements DataProvider {
  readonly id = "binance" as const;

  async getTicker24h(symbol: string): Promise<ProviderResult<Ticker24h>> {
    if (!isSupportedSymbol(symbol)) {
      return this.unavailable<Ticker24h>(`不支援的交易對：${symbol}`);
    }
    try {
      const res = await fetchWithRetry(
        `${env.binanceBaseUrl}/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`,
      );
      const raw = (await res.json()) as Binance24hrTicker;
      const fetchedAt = Date.now();
      return {
        source: "binance",
        freshness: "live",
        fetchedAt,
        data: {
          symbol,
          price: Number(raw.lastPrice),
          changePercent24h: Number(raw.priceChangePercent),
          volume24h: Number(raw.volume),
          quoteVolume24h: Number(raw.quoteVolume),
          high24h: Number(raw.highPrice),
          low24h: Number(raw.lowPrice),
          fetchedAt,
        },
      };
    } catch (err) {
      return this.unavailableFromError<Ticker24h>(symbol, err);
    }
  }

  async getKlines(query: KlinesQuery): Promise<ProviderResult<Candle[]>> {
    if (!isSupportedSymbol(query.symbol)) {
      return this.unavailable<Candle[]>(`不支援的交易對：${query.symbol}`);
    }
    const params = new URLSearchParams({
      symbol: query.symbol,
      interval: query.interval,
      limit: String(Math.min(query.limit ?? 500, 1000)),
    });
    if (query.startTime) params.set("startTime", String(query.startTime));
    if (query.endTime) params.set("endTime", String(query.endTime));

    try {
      const res = await fetchWithRetry(`${env.binanceBaseUrl}/api/v3/klines?${params.toString()}`);
      const raw = (await res.json()) as BinanceKline[];
      const nowMs = Date.now();
      const candles = raw.map((row) => toCandle(row, nowMs));
      return {
        source: "binance",
        freshness: "live",
        fetchedAt: nowMs,
        data: candles,
      };
    } catch (err) {
      // 交易對可能實際不存在於現貨市場（例如尚未上市），先確認再回覆明確原因
      const exists = await checkSymbolExists(query.symbol);
      if (!exists) {
        return this.unavailable<Candle[]>(`Binance 現貨市場目前查無交易對 ${query.symbol}`);
      }
      return this.unavailableFromError<Candle[]>(query.symbol, err);
    }
  }

  private unavailable<T>(reason: string): ProviderResult<T> {
    return {
      source: "binance",
      freshness: "historical",
      fetchedAt: Date.now(),
      unavailable: { reason },
      data: undefined as unknown as T,
    };
  }

  private unavailableFromError<T>(symbol: string, err: unknown): ProviderResult<T> {
    const reason =
      err instanceof UpstreamFetchError
        ? `無法取得 ${symbol} 資料：${err.message}`
        : `無法取得 ${symbol} 資料，請稍後再試`;
    return this.unavailable<T>(reason);
  }
}
