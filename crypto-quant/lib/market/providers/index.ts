import { env } from "@/lib/env";
import { cached } from "@/lib/market/cache";
import { BinanceProvider } from "@/lib/market/providers/binanceProvider";
import { DemoProvider } from "@/lib/market/providers/demoProvider";
import type { Candle, DataProvider, KlinesQuery, ProviderResult, Ticker24h } from "@/lib/market/types";

// 資料供應層抽象化：未來新增 CoinGecko / CoinMarketCap 等來源，
// 只需實作 DataProvider 介面並在此註冊，其餘程式碼不需更動。
const providers: Record<string, DataProvider> = {
  binance: new BinanceProvider(),
  demo: new DemoProvider(),
};

export function getActiveProvider(): DataProvider {
  return providers[env.dataProvider] ?? providers.binance!;
}

export async function getTicker24hCached(symbol: string): Promise<ProviderResult<Ticker24h>> {
  const provider = getActiveProvider();
  const key = `ticker:${provider.id}:${symbol}`;
  const { value } = await cached(key, env.cacheTtlTickerSeconds, () => provider.getTicker24h(symbol));
  return value;
}

export async function getKlinesCached(query: KlinesQuery): Promise<ProviderResult<Candle[]>> {
  const provider = getActiveProvider();
  const key = `klines:${provider.id}:${query.symbol}:${query.interval}:${query.startTime ?? ""}:${query.endTime ?? ""}:${query.limit ?? ""}`;
  const { value } = await cached(key, env.cacheTtlKlinesSeconds, () => provider.getKlines(query));
  return value;
}
