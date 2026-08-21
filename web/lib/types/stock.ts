// Core domain types shared across services, API routes, and UI components.

export type KLineInterval = "D" | "W" | "M";
export type KLineRange = "1M" | "3M" | "6M" | "1Y" | "3Y" | "5Y";

export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  prevClose: number;
  volume: number; // 張
  amount: number; // 成交金額（元）
  updatedAt: string; // ISO timestamp of when we fetched this
  asOfDate: string; // trading date this OHLC data is from (YYYY-MM-DD)
  isMock: boolean;
}

export interface OhlcvBar {
  date: string; // ISO date
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MovingAverages {
  ma5: number | null;
  ma10: number | null;
  ma20: number | null;
  ma60: number | null;
  ma120: number | null;
  ma240: number | null;
}

export interface MacdResult {
  dif: number;
  macd: number;
  osc: number;
  signal: "golden_cross" | "death_cross" | "bullish" | "bearish" | "neutral";
}

export interface KdResult {
  k: number;
  d: number;
  signal: "golden_cross" | "death_cross" | "overbought" | "oversold" | "neutral";
}

export interface VolumeStats {
  today: number;
  avg5: number;
  avg20: number;
  avg60: number;
  ratioVsAvg20: number;
}

export interface TechnicalIndicators {
  ma: MovingAverages;
  rsi14: number;
  macd: MacdResult;
  kd: KdResult;
  volumeStats: VolumeStats;
}

export type TrendPattern = "多頭排列" | "盤整" | "空頭排列";

export interface TechnicalAnalysisResult {
  trendPattern: TrendPattern;
  aboveMa5: boolean;
  aboveMa20: boolean;
  aboveMa60: boolean;
  aboveMa120: boolean;
  aboveMa240: boolean;
  rsiZone: "overbought" | "neutral" | "oversold";
  narrative: string;
  volumeNarrative: string;
}

// ---- Phase 2 types (defined now per StockDataProvider interface, unused by UI until Phase 2) ----

export interface FundamentalData {
  symbol: string;
  eps: number;
  pe: number;
  pb: number;
  roe: number;
  grossMargin: number;
  operatingMargin: number;
  netMargin: number;
  revenue: number;
  revenueYoY: number;
  revenueMoM: number;
  grossMarginTrend: "up" | "down" | "flat";
  isMock: boolean;
}

export interface QuarterlyEps {
  quarter: string; // e.g. "2025 Q1"
  eps: number;
}

export interface MonthlyRevenue {
  month: string; // e.g. "2026-07"
  revenue: number;
  mom: number;
  yoy: number;
}

export interface InstitutionalTradingSnapshot {
  today: number;
  last5d: number;
  last20d: number;
}

export interface InstitutionalTrading {
  symbol: string;
  foreign: InstitutionalTradingSnapshot;
  trust: InstitutionalTradingSnapshot;
  dealer: InstitutionalTradingSnapshot;
  narrative: string;
  isMock: boolean;
}

export interface MarginTrading {
  symbol: string;
  marginBalance: number;
  marginChange: number;
  shortBalance: number;
  shortChange: number;
  shortMarginRatio: number;
  flags: string[]; // e.g. ["融資大增", "券資比偏高"]
  isMock: boolean;
}

// ---- AI analysis / scoring ----

export interface AIScoreBreakdown {
  technical: number; // 0-30
  fundamental: number; // 0-30
  chip: number; // 0-20
  momentum: number; // 0-10
  risk: number; // 0-10 (higher = lower risk)
  total: number; // 0-100
  label: "偏多" | "中性" | "偏空";
}

export interface AIAnalysisResult {
  trendSummary: string;
  technicalSummary: string;
  fundamentalSummary: string;
  chipSummary: string;
  riskWarnings: string[];
}

export interface StockAnalysisResponse {
  quote: StockQuote;
  technical: TechnicalIndicators;
  technicalAnalysis: TechnicalAnalysisResult;
  score: AIScoreBreakdown;
  analysis: AIAnalysisResult;
  institutional: InstitutionalTrading;
}

export interface MarketOverview {
  indexValue: number;
  indexChange: number;
  indexChangePercent: number;
  advancers: number;
  decliners: number;
  totalVolume: number; // 億元
  updatedAt: string;
  isMock: boolean;
}

export interface StockSearchResult {
  symbol: string;
  name: string;
}

export interface WatchlistItem {
  symbol: string;
  name: string;
  addedAt: string;
}

export interface HoldingItem {
  symbol: string;
  name: string;
  avgCost: number; // 平均成本（每股）
  shares: number; // 持有股數
  purchaseDate?: string; // YYYY-MM-DD，未填時以預設回溯區間估算報酬曲線
  addedAt: string;
}

export interface HoldingMetrics {
  symbol: string;
  costBasis: number; // avgCost * shares
  marketValue: number; // currentPrice * shares
  unrealizedPL: number;
  returnPercent: number;
}

export interface PortfolioSummary {
  totalCost: number;
  totalMarketValue: number;
  totalUnrealizedPL: number;
  totalReturnPercent: number;
}

export interface PortfolioReturnPoint {
  date: string;
  cost: number; // 累積已投入成本（依各持股買入日期分階段計入）
  value: number; // 當日組合市值
  returnPercent: number;
}
