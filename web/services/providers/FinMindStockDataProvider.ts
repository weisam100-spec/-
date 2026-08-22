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

interface FinMindRevenueRow {
  date: string;
  stock_id: string;
  country: string;
  revenue: number;
  revenue_month: number;
  revenue_year: number;
}

interface FinMindInstitutionalRow {
  date: string;
  stock_id: string;
  name: string; // e.g. "Foreign_Investor", "Foreign_Dealer_Self", "Investment_Trust", "Dealer_self", "Dealer_Hedging"
  buy: number; // shares
  sell: number; // shares
}

interface FinMindMarginRow {
  date: string;
  stock_id: string;
  MarginPurchaseTodayBalance: number;
  MarginPurchaseYesterdayBalance: number;
  ShortSaleTodayBalance: number;
  ShortSaleYesterdayBalance: number;
}

interface FinMindPerRow {
  date: string;
  stock_id: string;
  PER: number;
  PBR: number;
  dividend_yield: number;
}

interface FinMindFinancialStatementRow {
  date: string;
  stock_id: string;
  type: string; // e.g. "EPS", "Revenue", "GrossProfit", "OperatingIncome", "IncomeAfterTaxes"
  value: number;
  origin_name?: string;
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

function dateNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateString(d);
}

function monthlyRevenueFromRows(rows: FinMindRevenueRow[]): MonthlyRevenue[] {
  const sorted = [...rows].sort(
    (a, b) => a.revenue_year - b.revenue_year || a.revenue_month - b.revenue_month
  );
  const byKey = new Map(sorted.map((r) => [`${r.revenue_year}-${r.revenue_month}`, r.revenue]));
  const result: MonthlyRevenue[] = sorted.map((cur, i) => {
    const monthKey = `${cur.revenue_year}-${String(cur.revenue_month).padStart(2, "0")}`;
    const prevRevenue = i > 0 ? sorted[i - 1].revenue : undefined;
    const mom = prevRevenue ? round2(((cur.revenue - prevRevenue) / prevRevenue) * 100) : 0;
    const yoyMonth = cur.revenue_month;
    const yoyYear = cur.revenue_year - 1;
    const yoyRevenue = byKey.get(`${yoyYear}-${yoyMonth}`);
    const yoy = yoyRevenue ? round2(((cur.revenue - yoyRevenue) / yoyRevenue) * 100) : 0;
    return { month: monthKey, revenue: Math.round(cur.revenue), mom, yoy };
  });
  return result.slice(-24);
}

/** FinMind financial-statement rows are dated at quarter-end; map that to a "YYYY Qn" label. */
function quarterLabelFromDate(dateStr: string): string {
  const [yearStr, monthStr] = dateStr.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const quarter = Math.ceil(month / 3);
  return `${year} Q${quarter}`;
}

function classifyInstitution(name: string): "foreign" | "trust" | "dealer" | null {
  if (name.startsWith("Foreign")) return "foreign";
  if (name.startsWith("Investment_Trust")) return "trust";
  if (name.startsWith("Dealer")) return "dealer";
  return null;
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

  // Homepage market overview (index/advancers/decliners) isn't wired to a
  // real source yet — aggregating that across the whole market is a bigger
  // job than a per-symbol lookup, left for a later pass.
  getMarketOverview(): Promise<MarketOverview> {
    return this.mock.getMarketOverview();
  }

  async getMonthlyRevenue(symbolOrName: string): Promise<MonthlyRevenue[]> {
    const symbol = normalizeSymbolInput(symbolOrName);
    try {
      const rows = await fetchFinMindDataset<FinMindRevenueRow>("TaiwanStockMonthRevenue", {
        data_id: symbol,
        start_date: dateNDaysAgo(26 * 31),
      });
      if (rows.length === 0) throw new Error("empty");
      return monthlyRevenueFromRows(rows);
    } catch {
      return this.mock.getMonthlyRevenue(symbol);
    }
  }

  async getInstitutionalTrading(symbolOrName: string): Promise<InstitutionalTrading> {
    const symbol = normalizeSymbolInput(symbolOrName);
    let rows: FinMindInstitutionalRow[] = [];
    try {
      rows = await fetchFinMindDataset<FinMindInstitutionalRow>(
        "TaiwanStockInstitutionalInvestorsBuySell",
        { data_id: symbol, start_date: dateNDaysAgo(40) }
      );
    } catch {
      return this.mock.getInstitutionalTrading(symbol);
    }
    if (rows.length === 0) return this.mock.getInstitutionalTrading(symbol);

    const byDate = new Map<string, { foreign: number; trust: number; dealer: number }>();
    for (const row of rows) {
      const category = classifyInstitution(row.name);
      if (!category) continue;
      const net = (Number(row.buy) || 0) - (Number(row.sell) || 0);
      const entry = byDate.get(row.date) ?? { foreign: 0, trust: 0, dealer: 0 };
      entry[category] += net;
      byDate.set(row.date, entry);
    }
    const dates = Array.from(byDate.keys()).sort();
    const toLots = (shares: number) => Math.round(shares / 1000);
    const sumNet = (ds: string[], key: "foreign" | "trust" | "dealer") =>
      ds.reduce((sum, d) => sum + (byDate.get(d)?.[key] ?? 0), 0);
    const snapshot = (key: "foreign" | "trust" | "dealer") => ({
      today: toLots(sumNet(dates.slice(-1), key)),
      last5d: toLots(sumNet(dates.slice(-5), key)),
      last20d: toLots(sumNet(dates.slice(-20), key)),
    });

    const foreign = snapshot("foreign");
    const trust = snapshot("trust");
    const dealer = snapshot("dealer");
    const bullish = foreign.last5d > 0 && trust.last5d > 0;
    return {
      symbol,
      foreign,
      trust,
      dealer,
      narrative: bullish
        ? "外資與投信近5日呈現買超，法人籌碼偏多。"
        : "近5日法人買賣方向分歧或轉為賣超，籌碼面偏中性至偏弱，建議留意後續籌碼變化。",
      isMock: false,
    };
  }

  async getMarginTrading(symbolOrName: string): Promise<MarginTrading> {
    const symbol = normalizeSymbolInput(symbolOrName);
    let rows: FinMindMarginRow[] = [];
    try {
      rows = await fetchFinMindDataset<FinMindMarginRow>("TaiwanStockMarginPurchaseShortSale", {
        data_id: symbol,
        start_date: dateNDaysAgo(10),
      });
    } catch {
      return this.mock.getMarginTrading(symbol);
    }
    if (rows.length === 0) return this.mock.getMarginTrading(symbol);

    const sorted = [...rows].sort((a, b) => (a.date < b.date ? -1 : 1));
    const latest = sorted[sorted.length - 1];
    const marginBalance = Number(latest.MarginPurchaseTodayBalance) || 0;
    const marginChange = marginBalance - (Number(latest.MarginPurchaseYesterdayBalance) || 0);
    const shortBalance = Number(latest.ShortSaleTodayBalance) || 0;
    const shortChange = shortBalance - (Number(latest.ShortSaleYesterdayBalance) || 0);
    const shortMarginRatio = marginBalance > 0 ? round2((shortBalance / marginBalance) * 100) : 0;

    const flags: string[] = [];
    if (marginBalance > 0 && marginChange > marginBalance * 0.1) flags.push("融資大增");
    if (marginBalance > 0 && marginChange < -marginBalance * 0.1) flags.push("融資減少");
    if (shortBalance > 0 && shortChange > shortBalance * 0.15) flags.push("融券增加");
    if (flags.length === 0) flags.push("籌碼沉澱");

    return {
      symbol,
      marginBalance: Math.round(marginBalance),
      marginChange: Math.round(marginChange),
      shortBalance: Math.round(shortBalance),
      shortChange: Math.round(shortChange),
      shortMarginRatio,
      flags,
      isMock: false,
    };
  }

  async getQuarterlyEps(symbolOrName: string): Promise<QuarterlyEps[]> {
    const symbol = normalizeSymbolInput(symbolOrName);
    try {
      const rows = await fetchFinMindDataset<FinMindFinancialStatementRow>(
        "TaiwanStockFinancialStatements",
        { data_id: symbol, start_date: dateNDaysAgo(365 * 3) }
      );
      const epsRows = rows
        .filter((r) => r.type === "EPS")
        .sort((a, b) => (a.date < b.date ? -1 : 1));
      if (epsRows.length === 0) throw new Error("empty");
      return epsRows.slice(-8).map((r) => ({
        quarter: quarterLabelFromDate(r.date),
        eps: round2(Number(r.value) || 0),
      }));
    } catch {
      return this.mock.getQuarterlyEps(symbol);
    }
  }

  async getFundamentals(symbolOrName: string): Promise<FundamentalData> {
    const symbol = normalizeSymbolInput(symbolOrName);

    const [perResult, revenueResult, epsResult] = await Promise.allSettled([
      fetchFinMindDataset<FinMindPerRow>("TaiwanStockPER", { data_id: symbol, start_date: dateNDaysAgo(20) }),
      this.getMonthlyRevenue(symbol),
      this.getQuarterlyEps(symbol),
    ]);

    const perRows = perResult.status === "fulfilled" ? perResult.value : [];
    if (perRows.length === 0) {
      // No real PE/PB available for this symbol (e.g. some ETFs) — fall back wholesale.
      return this.mock.getFundamentals(symbol);
    }
    const latestPer = [...perRows].sort((a, b) => (a.date < b.date ? -1 : 1)).at(-1)!;

    const revenues = revenueResult.status === "fulfilled" ? revenueResult.value : [];
    const latestRevenue = revenues.at(-1);

    // ROE / margin ratios need balance-sheet line items we don't parse yet —
    // still model-estimated (seeded, not fabricated to look precise) until
    // that's wired up for real.
    const mockFundamentals = await this.mock.getFundamentals(symbol);

    const epsSeries = epsResult.status === "fulfilled" ? epsResult.value : [];
    const eps = epsSeries.at(-1)?.eps ?? mockFundamentals.eps;

    return {
      symbol,
      eps,
      pe: round2(Number(latestPer.PER) || mockFundamentals.pe),
      pb: round2(Number(latestPer.PBR) || mockFundamentals.pb),
      roe: mockFundamentals.roe,
      grossMargin: mockFundamentals.grossMargin,
      operatingMargin: mockFundamentals.operatingMargin,
      netMargin: mockFundamentals.netMargin,
      revenue: latestRevenue ? latestRevenue.revenue : mockFundamentals.revenue,
      revenueYoY: latestRevenue ? latestRevenue.yoy : mockFundamentals.revenueYoY,
      revenueMoM: latestRevenue ? latestRevenue.mom : mockFundamentals.revenueMoM,
      grossMarginTrend: mockFundamentals.grossMarginTrend,
      isMock: false,
    };
  }
}
