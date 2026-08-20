import { NextResponse } from "next/server";
import type { KLineInterval, KLineRange } from "@/lib/types/stock";
import { stockDataProvider } from "@/services/providers";
import { StockNotFoundError } from "@/services/providers/StockDataProvider";
import { FinMindRequestError } from "@/services/providers/finmind/client";

// Always computed per-request (live fetch and/or date-seeded mock data).
export const dynamic = "force-dynamic";

const VALID_INTERVALS: KLineInterval[] = ["D", "W", "M"];
const VALID_RANGES: KLineRange[] = ["1M", "3M", "6M", "1Y", "3Y", "5Y"];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const { searchParams } = new URL(request.url);
  const interval = (searchParams.get("interval") ?? "D") as KLineInterval;
  const range = (searchParams.get("range") ?? "6M") as KLineRange;

  if (!VALID_INTERVALS.includes(interval)) {
    return NextResponse.json({ error: `不支援的 K 線週期：${interval}` }, { status: 400 });
  }
  if (!VALID_RANGES.includes(range)) {
    return NextResponse.json({ error: `不支援的區間：${range}` }, { status: 400 });
  }

  try {
    const bars = await stockDataProvider.getStockHistory(symbol, interval, range);
    return NextResponse.json(bars);
  } catch (err) {
    if (err instanceof StockNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof FinMindRequestError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    throw err;
  }
}
