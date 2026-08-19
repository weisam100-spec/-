import type { StockSearchResult } from "@/lib/types/stock";

// Static lookup list used for search autocomplete and homepage "熱門股票".
// This is NOT price data — just symbol/name pairs. Real price data always
// comes from StockDataProvider (Mock in Phase 1).
export const KNOWN_STOCKS: StockSearchResult[] = [
  { symbol: "2330", name: "台積電" },
  { symbol: "2454", name: "聯發科" },
  { symbol: "2317", name: "鴻海" },
  { symbol: "2382", name: "廣達" },
  { symbol: "3037", name: "欣興" },
  { symbol: "3711", name: "日月光投控" },
  { symbol: "3443", name: "創意" },
  { symbol: "3661", name: "世芯-KY" },
  { symbol: "3017", name: "奇鋐" },
  { symbol: "3324", name: "雙鴻" },
  { symbol: "2383", name: "台光電" },
  { symbol: "6213", name: "聯茂" },
  { symbol: "2449", name: "京元電子" },
  { symbol: "0050", name: "元大台灣50" },
];

export const HOT_STOCK_SYMBOLS = ["2330", "2317", "2454", "3017", "6213"];

export function findKnownStock(symbolOrName: string): StockSearchResult | undefined {
  const q = symbolOrName.trim().toLowerCase();
  return KNOWN_STOCKS.find(
    (s) => s.symbol.toLowerCase() === q || s.name.toLowerCase() === q
  );
}

export function searchKnownStocks(query: string, limit = 8): StockSearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return KNOWN_STOCKS.filter(
    (s) => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
  ).slice(0, limit);
}
