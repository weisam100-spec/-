import { NextResponse } from "next/server";
import type { StockQuote } from "@/lib/types/stock";
import { stockDataProvider } from "@/services/providers";

// Always computed per-request (live fetch and/or date-seeded mock data).
export const dynamic = "force-dynamic";

/** Batch quote lookup, used by the watchlist to avoid one request per row. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbols = (searchParams.get("symbols") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const results = await Promise.all(
    symbols.map((symbol) =>
      stockDataProvider.getStockQuote(symbol).catch(() => null)
    )
  );

  const quotes: StockQuote[] = results.filter((q): q is StockQuote => q !== null);
  return NextResponse.json(quotes);
}
