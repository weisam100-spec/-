// 集中讀取環境變數，提供預設值並避免在多處直接讀取 process.env
function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true" || value === "1";
}

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  dataProvider: (process.env.DATA_PROVIDER ?? "binance") as "binance" | "demo",
  binanceBaseUrl: process.env.BINANCE_BASE_URL ?? "https://api.binance.com",
  fxProvider: (process.env.FX_PROVIDER ?? "fixed") as "fixed" | "external",
  fxUsdtTwdFallback: num(process.env.FX_USDT_TWD_FALLBACK, 32.5),
  databaseFile: process.env.DATABASE_FILE ?? "./data/app.db",
  cacheTtlTickerSeconds: num(process.env.CACHE_TTL_TICKER_SECONDS, 15),
  cacheTtlKlinesSeconds: num(process.env.CACHE_TTL_KLINES_SECONDS, 60),
  fetchMaxRetries: num(process.env.FETCH_MAX_RETRIES, 3),
  fetchRetryBaseMs: num(process.env.FETCH_RETRY_BASE_MS, 500),
  rateLimitPerMinute: num(process.env.RATE_LIMIT_PER_MINUTE, 60),
  backtestMaxBars: num(process.env.BACKTEST_MAX_BARS, 20000),
  backtestTimeoutMs: num(process.env.BACKTEST_TIMEOUT_MS, 15000),
  enableLiveTrading: bool(process.env.ENABLE_LIVE_TRADING, false),
  appTimezone: process.env.APP_TIMEZONE ?? "Asia/Taipei",
};
