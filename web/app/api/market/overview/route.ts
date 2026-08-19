import { NextResponse } from "next/server";
import { stockDataProvider } from "@/services/providers/MockStockDataProvider";

// Always computed per-request — mock data is seeded by the current date.
export const dynamic = "force-dynamic";

export async function GET() {
  const overview = await stockDataProvider.getMarketOverview();
  return NextResponse.json(overview);
}
