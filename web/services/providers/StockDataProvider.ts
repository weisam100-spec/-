import type {
  FundamentalData,
  InstitutionalTrading,
  KLineInterval,
  KLineRange,
  MarginTrading,
  MarketOverview,
  MonthlyRevenue,
  OhlcvBar,
  QuarterlyEps,
  StockQuote,
  StockSearchResult,
} from "@/lib/types/stock";

/**
 * Abstraction over "where stock data comes from". Swap the implementation
 * (e.g. to a real TWSE/TPEx-backed provider) without touching API routes,
 * analysis engines, or UI components — they only ever depend on this
 * interface.
 */
export interface StockDataProvider {
  getStockQuote(symbol: string): Promise<StockQuote>;
  getStockHistory(
    symbol: string,
    interval: KLineInterval,
    range: KLineRange
  ): Promise<OhlcvBar[]>;
  getMarketOverview(): Promise<MarketOverview>;
  getHotStocks(limit?: number): Promise<StockQuote[]>;
  searchStocks(query: string): Promise<StockSearchResult[]>;

  // Phase 2 — declared now so the interface is stable; MockStockDataProvider
  // already implements these, but Phase 1 UI does not call them yet.
  getFundamentals(symbol: string): Promise<FundamentalData>;
  getQuarterlyEps(symbol: string): Promise<QuarterlyEps[]>;
  getMonthlyRevenue(symbol: string): Promise<MonthlyRevenue[]>;
  getInstitutionalTrading(symbol: string): Promise<InstitutionalTrading>;
  getMarginTrading(symbol: string): Promise<MarginTrading>;
}

export class StockNotFoundError extends Error {
  constructor(symbol: string) {
    super(`找不到股票代號或名稱：${symbol}`);
    this.name = "StockNotFoundError";
  }
}
