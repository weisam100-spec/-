import { INTERVAL_MS, isSupportedSymbol, type Interval } from "@/lib/market/symbols";
import type {
  Candle,
  DataProvider,
  KlinesQuery,
  ProviderResult,
  Ticker24h,
} from "@/lib/market/types";

// ============================================================
// DEMO 模擬資料來源
// 僅供本機開發 / 無法連線交易所時展示介面使用，資料以確定性亂數產生，
// 絕不可在正式環境當成真實行情。所有輸出都會標記 freshness: "demo"，
// 前端必須顯示「DEMO 模擬資料」樣式的明顯提示。
// ============================================================

const BASE_PRICE: Record<string, number> = {
  BTCUSDT: 65000,
  ETHUSDT: 3400,
  BNBUSDT: 580,
  SOLUSDT: 140,
  XRPUSDT: 0.6,
  HYPEUSDT: 22,
};

function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(symbol: string, interval: string): number {
  let h = 0;
  for (const ch of `${symbol}:${interval}`) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return h;
}

function generateSeries(symbol: string, interval: Interval, count: number, endTime: number): Candle[] {
  const base = BASE_PRICE[symbol] ?? 100;
  const rand = mulberry32(hashSeed(symbol, interval));
  const stepMs = INTERVAL_MS[interval];
  const candles: Candle[] = [];
  let price = base * (0.85 + rand() * 0.3);
  const startTime = endTime - (count - 1) * stepMs;

  for (let i = 0; i < count; i++) {
    const openTime = startTime + i * stepMs;
    const drift = (rand() - 0.498) * 0.006;
    const vol = 0.004 + rand() * 0.01;
    const open = price;
    const close = Math.max(0.000001, open * (1 + drift));
    const high = Math.max(open, close) * (1 + rand() * vol);
    const low = Math.min(open, close) * (1 - rand() * vol);
    const volume = base * (50 + rand() * 200);
    candles.push({
      openTime,
      open,
      high,
      low,
      close,
      volume,
      closed: openTime + stepMs <= endTime,
    });
    price = close;
  }
  return candles;
}

export class DemoProvider implements DataProvider {
  readonly id = "demo" as const;

  async getTicker24h(symbol: string): Promise<ProviderResult<Ticker24h>> {
    if (!isSupportedSymbol(symbol)) {
      return {
        source: "demo",
        freshness: "demo",
        fetchedAt: Date.now(),
        unavailable: { reason: `不支援的交易對：${symbol}` },
        data: undefined as unknown as Ticker24h,
      };
    }
    const candles = generateSeries(symbol, "1h", 25, Date.now());
    const last = candles[candles.length - 1]!;
    const dayAgo = candles[0]!;
    const changePercent24h = ((last.close - dayAgo.open) / dayAgo.open) * 100;
    const high24h = Math.max(...candles.map((c) => c.high));
    const low24h = Math.min(...candles.map((c) => c.low));
    const volume24h = candles.reduce((sum, c) => sum + c.volume, 0);
    return {
      source: "demo",
      freshness: "demo",
      fetchedAt: Date.now(),
      data: {
        symbol,
        price: last.close,
        changePercent24h,
        volume24h,
        quoteVolume24h: volume24h * last.close,
        high24h,
        low24h,
        fetchedAt: Date.now(),
      },
    };
  }

  async getKlines(query: KlinesQuery): Promise<ProviderResult<Candle[]>> {
    if (!isSupportedSymbol(query.symbol)) {
      return {
        source: "demo",
        freshness: "demo",
        fetchedAt: Date.now(),
        unavailable: { reason: `不支援的交易對：${query.symbol}` },
        data: [],
      };
    }
    const limit = Math.min(query.limit ?? 500, 1000);
    const endTime = query.endTime ?? Date.now();
    const candles = generateSeries(query.symbol, query.interval, limit, endTime);
    return {
      source: "demo",
      freshness: "demo",
      fetchedAt: Date.now(),
      data: candles,
    };
  }
}
