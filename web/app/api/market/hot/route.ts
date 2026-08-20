import { NextResponse } from "next/server";
import { stockDataProvider } from "@/services/providers";

// Always computed per-request (live fetch and/or date-seeded mock data).
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? "5");
  const stocks = await stockDataProvider.getHotStocks(limit);
  return NextResponse.json(stocks);
}
