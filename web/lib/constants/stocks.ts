import type { StockSearchResult } from "@/lib/types/stock";

// Curated lookup list used for search autocomplete and homepage "熱門股票".
// This is NOT the full universe of queryable stocks — StockDataProvider
// (FinMind) can look up any valid TWSE/TPEx code even if it's not listed
// here; see resolveSymbolCandidate() below. This list just gives the
// autocomplete dropdown good suggestions without a network round-trip.
export const KNOWN_STOCKS: StockSearchResult[] = [
  // 半導體/電子
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
  { symbol: "2303", name: "聯電" },
  { symbol: "2379", name: "瑞昱" },
  { symbol: "2408", name: "南亞科" },
  { symbol: "2344", name: "華邦電" },
  { symbol: "3034", name: "聯詠" },
  { symbol: "3008", name: "大立光" },
  { symbol: "2357", name: "華碩" },
  { symbol: "2377", name: "微星" },
  { symbol: "2409", name: "友達" },
  { symbol: "3481", name: "群創" },
  { symbol: "3163", name: "波若威" },
  { symbol: "2308", name: "台達電" },
  // 電信
  { symbol: "2412", name: "中華電" },
  { symbol: "3045", name: "台灣大" },
  { symbol: "4904", name: "遠傳" },
  // 金融
  { symbol: "2882", name: "國泰金" },
  { symbol: "2881", name: "富邦金" },
  { symbol: "2891", name: "中信金" },
  { symbol: "2886", name: "兆豐金" },
  { symbol: "2884", name: "玉山金" },
  { symbol: "2892", name: "第一金" },
  { symbol: "2880", name: "華南金" },
  { symbol: "2885", name: "元大金" },
  { symbol: "2887", name: "台新金" },
  { symbol: "2890", name: "永豐金" },
  { symbol: "2883", name: "開發金" },
  { symbol: "5880", name: "合庫金" },
  { symbol: "5871", name: "中租-KY" },
  // 傳產/塑化/鋼鐵
  { symbol: "1301", name: "台塑" },
  { symbol: "1303", name: "南亞" },
  { symbol: "1326", name: "台化" },
  { symbol: "6505", name: "台塑化" },
  { symbol: "2002", name: "中鋼" },
  { symbol: "1101", name: "台泥" },
  { symbol: "1102", name: "亞泥" },
  // 航運
  { symbol: "2603", name: "長榮" },
  { symbol: "2609", name: "陽明" },
  { symbol: "2615", name: "萬海" },
  { symbol: "2618", name: "長榮航" },
  { symbol: "2610", name: "華航" },
  // 消費/食品/其他
  { symbol: "1216", name: "統一" },
  { symbol: "2912", name: "統一超" },
  { symbol: "9910", name: "豐泰" },
  { symbol: "2207", name: "和泰車" },
  // ETF
  { symbol: "0050", name: "元大台灣50" },
  { symbol: "0056", name: "元大高股息" },
  { symbol: "00878", name: "國泰永續高股息" },
  { symbol: "00881", name: "國泰台灣5G+" },
  { symbol: "006208", name: "富邦台50" },
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

// Typical TWSE/TPEx tickers are 4-6 alphanumeric characters (e.g. "2330",
// "00881", "6213B"). Used to decide whether an unrecognized query is worth
// sending to FinMind at all, vs. rejecting obvious garbage input early.
const PLAUSIBLE_CODE = /^[0-9]{4,6}[A-Z]?$/i;

export function looksLikeStockCode(input: string): boolean {
  return PLAUSIBLE_CODE.test(input.trim());
}
