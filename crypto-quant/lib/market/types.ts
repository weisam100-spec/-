import type { Interval } from "./symbols";

// 標準化 OHLCV 格式，所有資料來源都必須轉換成此格式後才可進入系統
export interface Candle {
  /** K 棒開始時間（epoch ms, UTC） */
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  /** K 棒是否已收盤（未收盤的最後一根不可用於產生訊號） */
  closed: boolean;
}

export interface Ticker24h {
  symbol: string;
  price: number;
  changePercent24h: number;
  volume24h: number;
  quoteVolume24h: number;
  high24h: number;
  low24h: number;
  /** 資料抓取當下時間戳 */
  fetchedAt: number;
}

export type DataFreshness = "live" | "delayed" | "historical" | "demo";

export interface ProviderResult<T> {
  data: T;
  source: "binance" | "demo";
  freshness: DataFreshness;
  fetchedAt: number;
  /** 若資料來源不支援此交易對或抓取失敗，回傳明確的不可用原因，前端不得以假資料充當 */
  unavailable?: { reason: string };
}

export interface KlinesQuery {
  symbol: string;
  interval: Interval;
  /** epoch ms（含） */
  startTime?: number;
  endTime?: number;
  limit?: number;
}

export interface DataProvider {
  readonly id: "binance" | "demo";
  getTicker24h(symbol: string): Promise<ProviderResult<Ticker24h>>;
  getKlines(query: KlinesQuery): Promise<ProviderResult<Candle[]>>;
}
