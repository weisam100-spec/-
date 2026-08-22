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
import { findKnownStock, looksLikeStockCode, searchKnownStocks } from "@/lib/constants/stocks";
import { resampleMonthly, resampleWeekly } from "@/lib/utils/resampleBars";
import { StockDataProvider, StockNotFoundError } from "./StockDataProvider";
import { MockStockDataProvider } from "./MockStockDataProvider";
import { fetchFinMindDataset, fetchStockName } from "./finmind/client";

interface FinMindStockPriceRow {
  date: string;
  stock_id: string;
  Trading_Volume: number; // shares, not lots
  Trading_money: number;
  open: number;
  max: number;
  min: number;
  close: number;
  spread: number; // close - previous close, provided by FinMind
  Trading_turnover: number;
}

const RANGE_CALENDAR_DAYS: Record<KLineRange, number> = {
  "1M": 45,
  "3M": 110,
  "6M": 220,
  "1Y": 400,
  "3Y": 1150,
  "5Y": 1900,
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function toDateString(d: Date) {
  return d.toISOString().slice(0, 10);
}

/**
 * Resolves any valid-looking TW stock code even if it's not in our curated
 * KNOWN_STOCKS list — FinMind covers the full TWSE/TPEx universe, our list
 * is just autocomplete suggestions. Only rejects input that neither matches
 * a known name/symbol nor looks like a plausible code at all.
 */
async function resolveStock(symbolOrName: string): Promise<{ symbol: string; name: string }> {
  const known = findKnownStock(symbolOrName);
  if (known) return known;

  const trimmed = symbolOrName.trim();
  if (!looksLikeStockCode(trimmed)) {
    throw new StockNotFoundError(`${symbolOrName}（請輸入正確的股票代號，例如 2330）`);
  }
  const name = await fetchStockName(trimmed);
  return { symbol: trimmed, name: name ?? trimmed };
}

/** Lightweight, non-throwing symbol normalization for the mock-delegated methods below (no name needed). */
function normalizeSymbolInput(symbolOrName: string): string {
  return findKnownStock(symbolOrName)?.symbol ?? symbolOrName.trim();
}

function rowToBar(row: FinMindStockPriceRow): OhlcvBar {
  return {
    date: row.date,
    open: round2(row.open),
    high: round2(row.max),
    low: round2(row.min),
    close: round2(row.close),
    volume: Math.round((row.Trading_Volume || 0) / 1000), // shares -> 張
  };
}

async function fetchDailyBars(symbol: string, calendarDays: number): Promise<FinMindStockPriceRow[]> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - calendarDays);
  return fetchFinMindDataset<FinMindStockPriceRow>("TaiwanStockPrice", {
    data_id: symbol,
    start_date: toDateString(start),
    end_date: toDateString(end),
  });
}

/**
 * Real stock prices/history via FinMind (https://finmindtrade.com), which
 * aggregates official TWSE/TPEx data into free JSON — no key required for
 * light use. This is end-of-day data (updated after each trading day
 * closes), not tick-by-tick intraday quotes.
 *
 * Fundamentals/revenue/institutional-trading/margin-trading and the
 * homepage market overview are not wired to a real source yet, so those
 * still delegate to MockStockDataProvider (isMock: true) until Phase 2.
 */
export class FinMindStockDataProvider implements StockDataProvider {
  private mock = new MockStockDataProvider();

  async getStockQuote(symbolOrName: string): Promise<StockQuote> {
    const stock = await resolveStock(symbolOrName);
    const rows = await fetchDailyBars(stock.symbol, 15);
    if (rows.length === 0) {
      throw new StockNotFoundError(
        `${symbolOrName}（FinMind 查無此代號的近期成交資料，可能是代號錯誤或近期未交易）`
      );
    }

    const latest = rows[rows.length - 1];
    const spread = Number(latest.spread) || 0;
    const prevClose =
      rows.length >= 2 ? rows[rows.length - 2].close : round2(latest.close - spread);
    const change = spread !== 0 ? round2(spread) : round2(latest.close - prevClose);
    const changePercent = prevClose !== 0 ? round2((change / prevClose) * 100) : 0;
    const volume = Math.round((latest.Trading_Volume || 0) / 1000);

    return {
      symbol: stock.symbol,
      name: stock.name,
      price: round2(latest.close),
      change,
      changePercent,
      open: round2(latest.open),
      high: round2(latest.max),
      low: round2(latest.min),
      prevClose: round2(prevClose),
      volume,
      amount: Math.round(latest.Trading_money || 0),
      updatedAt: new Date().toISOString(),
      asOfDate: latest.date,
      isMock: false,
    };
  }

  async getStockHistory(
    symbolOrName: string,
    interval: KLineInterval,
    range: KLineRange
  ): Promise<OhlcvBar[]> {
    const stock = await resolveStock(symbolOrName);
    const rows = await fetchDailyBars(stock.symbol, RANGE_CALENDAR_DAYS[range]);
    if (rows.length === 0) {
      throw new StockNotFoundError(
        `${symbolOrName}（FinMind 查無此代號在這個區間的成交資料）`
      );
    }
    const daily = rows.map(rowToBar);

    if (interval === "D") return daily;
    if (interval === "W") return resampleWeekly(daily);
    return resampleMonthly(daily);
  }

  async getHotStocks(limit = 5): Promise<StockQuote[]> {
    const { HOT_STOCK_SYMBOLS } = await import("@/lib/constants/stocks");
    const symbols = HOT_STOCK_SYMBOLS.slice(0, limit);
    const results = await Promise.all(
      symbols.map((s) => this.getStockQuote(s).catch(() => null))
    );
    return results.filter((q): q is StockQuote => q !== null);
  }

  async searchStocks(query: string): Promise<StockSearchResult[]> {
    return searchKnownStocks(query);
  }

  // --- Not yet wired to a real source; delegated to mock (Phase 2) ---
  // Normalized (not fully resolved) since mock data never needs a real name
  // and accepts any symbol string — see MockStockDataProvider.

  getMarketOverview(): Promise<MarketOverview> {
    return this.mock.getMarketOverview();
  }

  getFundamentals(symbolOrName: string): Promise<FundamentalData> {
    return this.mock.getFundamentals(normalizeSymbolInput(symbolOrName));
  }

  getQuarterlyEps(symbolOrName: string): Promise<QuarterlyEps[]> {
    return this.mock.getQuarterlyEps(normalizeSymbolInput(symbolOrName));
  }

  getMonthlyRevenue(symbolOrName: string): Promise<MonthlyRevenue[]> {
    return this.mock.getMonthlyRevenue(normalizeSymbolInput(symbolOrName));
  }

  getInstitutionalTrading(symbolOrName: string): Promise<InstitutionalTrading> {
    return this.mock.getInstitutionalTrading(normalizeSymbolInput(symbolOrName));
  }

  getMarginTrading(symbolOrName: string): Promise<MarginTrading> {
    return this.mock.getMarginTrading(normalizeSymbolInput(symbolOrName));
  }
}
