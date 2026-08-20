import { NextResponse } from "next/server";
import { stockDataProvider } from "@/services/providers";

// Always computed per-request (live fetch and/or date-seeded mock data).
export const dynamic = "force-dynamic";

export async function GET() {
  const overview = await stockDataProvider.getMarketOverview();
  return NextResponse.json(overview);
}
