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

/** 幣安合約（期貨）公開統計「大戶帳戶多空比」週期，與現貨週期不完全相同，僅取兩邊皆支援的子集 */
export type LongShortRatioPeriod = "5m" | "15m" | "1h" | "4h" | "1d";

export interface LongShortRatioQuery {
  symbol: string;
  period: LongShortRatioPeriod;
  limit?: number;
}

export interface LongShortRatioPoint {
  /** epoch ms（UTC） */
  time: number;
  /** 大戶多倉帳戶占比（0~100） */
  longAccountPct: number;
  /** 大戶空倉帳戶占比（0~100） */
  shortAccountPct: number;
  /** 多空比 = 多倉占比 / 空倉占比 */
  longShortRatio: number;
}

export interface DataProvider {
  readonly id: "binance" | "demo";
  getTicker24h(symbol: string): Promise<ProviderResult<Ticker24h>>;
  getKlines(query: KlinesQuery): Promise<ProviderResult<Candle[]>>;
  /**
   * 大戶多空持倉比：資料來自幣安「合約（期貨）」市場的公開統計 API，
   * 與驅動本站其餘回測/策略的「現貨」市場是不同的市場，純粹作為讀取顯示的
   * 情緒參考指標，不代表、也不會讓本站具備合約下單或開槓桿的能力。
   */
  getTopTraderLongShortRatio(
    query: LongShortRatioQuery,
  ): Promise<ProviderResult<LongShortRatioPoint[]>>;
}
