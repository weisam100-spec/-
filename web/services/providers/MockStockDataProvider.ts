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
import { findKnownStock, searchKnownStocks } from "@/lib/constants/stocks";
import { createSeededRandom, todaySeedSuffix } from "@/lib/utils/seededRandom";
import { resampleMonthly, resampleWeekly } from "@/lib/utils/resampleBars";
import { StockDataProvider, StockNotFoundError } from "./StockDataProvider";

const RANGE_TRADING_DAYS: Record<KLineRange, number> = {
  "1M": 22,
  "3M": 65,
  "6M": 130,
  "1Y": 252,
  "3Y": 756,
  "5Y": 1260,
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function requireKnownStock(symbolOrName: string) {
  const stock = findKnownStock(symbolOrName);
  if (!stock) throw new StockNotFoundError(symbolOrName);
  return stock;
}

/**
 * Never throws: mock data is synthetic and seeded off the symbol string, so
 * it can happily generate plausible-looking numbers for any input, not just
 * the curated KNOWN_STOCKS list. Used by the methods FinMindStockDataProvider
 * delegates to, so those work for any real TW stock code too, not just the
 * ~60 in our autocomplete list.
 */
function resolveMockStock(symbolOrName: string): { symbol: string; name: string } {
  const known = findKnownStock(symbolOrName);
  if (known) return known;
  const trimmed = symbolOrName.trim();
  return { symbol: trimmed, name: trimmed };
}

/** Full daily bar series (~5y + buffer), stable per symbol, ending yesterday. */
function generateHistoricalDailySeries(symbol: string): OhlcvBar[] {
  const totalDays = RANGE_TRADING_DAYS["5Y"] + 40;
  const rand = createSeededRandom(`${symbol}:history`);
  let price = 20 + rand() * 980;

  const dates: Date[] = [];
  const cursor = new Date();
  cursor.setDate(cursor.getDate() - 1); // start from yesterday
  while (dates.length < totalDays) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() - 1);
  }
  dates.reverse();

  const bars: OhlcvBar[] = [];
  for (const date of dates) {
    const drift = (rand() - 0.48) * 0.02;
    const changePct = drift + (rand() - 0.5) * 0.03;
    const open = price;
    const close = Math.max(1, open * (1 + changePct));
    const high = Math.max(open, close) * (1 + rand() * 0.012);
    const low = Math.min(open, close) * (1 - rand() * 0.012);
    const volume = Math.round(1000 + rand() * 20000);
    bars.push({
      date: date.toISOString().slice(0, 10),
      open: round2(open),
      high: round2(high),
      low: round2(low),
      close: round2(close),
      volume,
    });
    price = close;
  }
  return bars;
}

/** Today's bar, re-seeded daily so the "live" quote changes once per day. */
function generateTodayBar(symbol: string, lastClose: number): OhlcvBar {
  const rand = createSeededRandom(`${symbol}:${todaySeedSuffix()}`);
  const changePct = (rand() - 0.5) * 0.05;
  const open = lastClose * (1 + (rand() - 0.5) * 0.01);
  const close = Math.max(1, open * (1 + changePct));
  const high = Math.max(open, close) * (1 + rand() * 0.015);
  const low = Math.min(open, close) * (1 - rand() * 0.015);
  const volume = Math.round(2000 + rand() * 30000);
  return {
    date: new Date().toISOString().slice(0, 10),
    open: round2(open),
    high: round2(high),
    low: round2(low),
    close: round2(close),
    volume,
  };
}

function getFullSeriesWithToday(symbol: string): OhlcvBar[] {
  const history = generateHistoricalDailySeries(symbol);
  const lastClose = history[history.length - 1].close;
  return [...history, generateTodayBar(symbol, lastClose)];
}

export class MockStockDataProvider implements StockDataProvider {
  async getStockQuote(symbolOrName: string): Promise<StockQuote> {
    const stock = requireKnownStock(symbolOrName);
    const series = getFullSeriesWithToday(stock.symbol);
    const today = series[series.length - 1];
    const prevClose = series[series.length - 2].close;
    const change = round2(today.close - prevClose);
    const changePercent = round2((change / prevClose) * 100);
    return {
      symbol: stock.symbol,
      name: stock.name,
      price: today.close,
      change,
      changePercent,
      open: today.open,
      high: today.high,
      low: today.low,
      prevClose,
      volume: today.volume,
      amount: Math.round(today.close * today.volume * 1000),
      updatedAt: new Date().toISOString(),
      asOfDate: today.date,
      isMock: true,
    };
  }

  async getStockHistory(
    symbolOrName: string,
    interval: KLineInterval,
    range: KLineRange
  ): Promise<OhlcvBar[]> {
    const stock = requireKnownStock(symbolOrName);
    const fullDaily = getFullSeriesWithToday(stock.symbol);
    const tradingDays = RANGE_TRADING_DAYS[range];
    const daily = fullDaily.slice(-Math.min(tradingDays, fullDaily.length));

    if (interval === "D") return daily;
    if (interval === "W") return resampleWeekly(daily);
    return resampleMonthly(daily);
  }

  async getMarketOverview(): Promise<MarketOverview> {
    const rand = createSeededRandom(`market:${todaySeedSuffix()}`);
    const indexValue = round2(20000 + rand() * 6000);
    const indexChange = round2((rand() - 0.4) * 300);
    return {
      indexValue,
      indexChange,
      indexChangePercent: round2((indexChange / (indexValue - indexChange)) * 100),
      advancers: Math.round(300 + rand() * 400),
      decliners: Math.round(300 + rand() * 400),
      totalVolume: round2(2000 + rand() * 3000),
      updatedAt: new Date().toISOString(),
      isMock: true,
    };
  }

  async getHotStocks(limit = 5): Promise<StockQuote[]> {
    const { HOT_STOCK_SYMBOLS } = await import("@/lib/constants/stocks");
    const symbols = HOT_STOCK_SYMBOLS.slice(0, limit);
    return Promise.all(symbols.map((s) => this.getStockQuote(s)));
  }

  async searchStocks(query: string): Promise<StockSearchResult[]> {
    return searchKnownStocks(query);
  }

  async getFundamentals(symbolOrName: string): Promise<FundamentalData> {
    const stock = resolveMockStock(symbolOrName);
    const rand = createSeededRandom(`${stock.symbol}:fundamentals:${todaySeedSuffix()}`);
    const eps = round2(0.5 + rand() * 15);
    const priceRand = createSeededRandom(`${stock.symbol}:basePrice`);
    const syntheticPrice = round2(20 + priceRand() * 980);
    const marginTrendRoll = rand();
    return {
      symbol: stock.symbol,
      eps,
      pe: round2(syntheticPrice / eps),
      pb: round2(1 + rand() * 8),
      roe: round2(5 + rand() * 25),
      grossMargin: round2(10 + rand() * 50),
      operatingMargin: round2(5 + rand() * 35),
      netMargin: round2(3 + rand() * 25),
      revenue: Math.round((500 + rand() * 9500) * 1_000_000),
      revenueYoY: round2((rand() - 0.3) * 40),
      revenueMoM: round2((rand() - 0.5) * 20),
      grossMarginTrend: marginTrendRoll > 0.6 ? "up" : marginTrendRoll > 0.3 ? "flat" : "down",
      isMock: true,
    };
  }

  async getQuarterlyEps(symbolOrName: string): Promise<QuarterlyEps[]> {
    const stock = resolveMockStock(symbolOrName);
    const rand = createSeededRandom(`${stock.symbol}:qeps`);
    const quarters = ["2024 Q3", "2024 Q4", "2025 Q1", "2025 Q2", "2025 Q3", "2025 Q4", "2026 Q1", "2026 Q2"];
    let eps = 1 + rand() * 5;
    return quarters.map((quarter) => {
      eps = Math.max(0.1, eps * (1 + (rand() - 0.4) * 0.3));
      return { quarter, eps: round2(eps) };
    });
  }

  async getMonthlyRevenue(symbolOrName: string): Promise<MonthlyRevenue[]> {
    const stock = resolveMockStock(symbolOrName);
    const rand = createSeededRandom(`${stock.symbol}:revenue`);
    const months: MonthlyRevenue[] = [];
    let revenue = (500 + rand() * 5000) * 1_000_000;
    const revenueByMonth: number[] = [];
    const now = new Date();
    for (let i = 23; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      revenue = Math.max(1_000_000, revenue * (1 + (rand() - 0.45) * 0.15));
      revenueByMonth.push(revenue);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const idx = revenueByMonth.length - 1;
      const mom = idx > 0 ? ((revenue - revenueByMonth[idx - 1]) / revenueByMonth[idx - 1]) * 100 : 0;
      const yoyBase = revenueByMonth[idx - 12];
      const yoy = yoyBase ? ((revenue - yoyBase) / yoyBase) * 100 : (rand() - 0.3) * 30;
      months.push({ month: monthKey, revenue: Math.round(revenue), mom: round2(mom), yoy: round2(yoy) });
    }
    return months;
  }

  async getInstitutionalTrading(symbolOrName: string): Promise<InstitutionalTrading> {
    const stock = resolveMockStock(symbolOrName);
    const rand = createSeededRandom(`${stock.symbol}:chip:${todaySeedSuffix()}`);
    const snap = () => ({
      today: Math.round((rand() - 0.45) * 3000),
      last5d: Math.round((rand() - 0.4) * 8000),
      last20d: Math.round((rand() - 0.35) * 25000),
    });
    const foreign = snap();
    const trust = snap();
    const dealer = snap();
    const bullish = foreign.last5d > 0 && trust.last5d > 0;
    return {
      symbol: stock.symbol,
      foreign,
      trust,
      dealer,
      narrative: bullish
        ? "外資與投信近5日呈現買超，法人籌碼偏多。"
        : "近5日法人買賣方向分歧或轉為賣超，籌碼面偏中性至偏弱，建議留意後續籌碼變化。",
      isMock: true,
    };
  }

  async getMarginTrading(symbolOrName: string): Promise<MarginTrading> {
    const stock = resolveMockStock(symbolOrName);
    const rand = createSeededRandom(`${stock.symbol}:margin:${todaySeedSuffix()}`);
    const marginBalance = Math.round(1000 + rand() * 20000);
    const marginChange = Math.round((rand() - 0.5) * 2000);
    const shortBalance = Math.round(100 + rand() * 3000);
    const shortChange = Math.round((rand() - 0.5) * 400);
    const shortMarginRatio = round2((shortBalance / marginBalance) * 100);
    const flags: string[] = [];
    if (marginChange > marginBalance * 0.1) flags.push("融資大增");
    if (marginChange < -marginBalance * 0.1) flags.push("融資減少");
    if (shortChange > shortBalance * 0.15) flags.push("融券增加");
    if (flags.length === 0) flags.push("籌碼沉澱");
    return {
      symbol: stock.symbol,
      marginBalance,
      marginChange,
      shortBalance,
      shortChange,
      shortMarginRatio,
      flags,
      isMock: true,
    };
  }
}

export const stockDataProvider: StockDataProvider = new MockStockDataProvider();
