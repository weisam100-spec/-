// 第一版支援的交易對白名單（Binance 現貨代號）
export interface SymbolMeta {
  symbol: string; // Binance 代號，例如 BTCUSDT
  base: string;
  quote: "USDT";
  displayName: string;
}

export const SUPPORTED_SYMBOLS: SymbolMeta[] = [
  { symbol: "BTCUSDT", base: "BTC", quote: "USDT", displayName: "比特幣 BTC/USDT" },
  { symbol: "ETHUSDT", base: "ETH", quote: "USDT", displayName: "以太幣 ETH/USDT" },
  { symbol: "BNBUSDT", base: "BNB", quote: "USDT", displayName: "幣安幣 BNB/USDT" },
  { symbol: "SOLUSDT", base: "SOL", quote: "USDT", displayName: "索拉納 SOL/USDT" },
  { symbol: "XRPUSDT", base: "XRP", quote: "USDT", displayName: "瑞波幣 XRP/USDT" },
  { symbol: "HYPEUSDT", base: "HYPE", quote: "USDT", displayName: "Hyperliquid HYPE/USDT" },
];

export const SUPPORTED_SYMBOL_SET = new Set(SUPPORTED_SYMBOLS.map((s) => s.symbol));

export function isSupportedSymbol(symbol: string): boolean {
  return SUPPORTED_SYMBOL_SET.has(symbol);
}

export type Interval = "5m" | "15m" | "1h" | "4h" | "1d";

export const SUPPORTED_INTERVALS: Interval[] = ["5m", "15m", "1h", "4h", "1d"];

export const INTERVAL_LABEL: Record<Interval, string> = {
  "5m": "5 分鐘",
  "15m": "15 分鐘",
  "1h": "1 小時",
  "4h": "4 小時",
  "1d": "日線",
};

export const INTERVAL_MS: Record<Interval, number> = {
  "5m": 5 * 60 * 1000,
  "15m": 15 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "4h": 4 * 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
};

export function isSupportedInterval(v: string): v is Interval {
  return (SUPPORTED_INTERVALS as string[]).includes(v);
}
