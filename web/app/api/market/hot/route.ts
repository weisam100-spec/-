import { NextResponse } from "next/server";
import { stockDataProvider } from "@/services/providers/MockStockDataProvider";

// Always computed per-request — mock data is seeded by the current date.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? "5");
  const stocks = await stockDataProvider.getHotStocks(limit);
  return NextResponse.json(stocks);
}
