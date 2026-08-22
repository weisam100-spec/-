import { NextResponse } from "next/server";
import type { StockAnalysisResponse } from "@/lib/types/stock";
import { stockDataProvider } from "@/services/providers";
import { buildTechnicalIndicators, classifyTechnical } from "@/services/analysis/technicalIndicators";
import { computeAIScore } from "@/services/analysis/aiScore";
import { buildAIAnalysis, buildTechnicalAnalysis } from "@/services/analysis/aiNarrative";

// Always computed per-request (live fetch and/or date-seeded mock data).
export const dynamic = "force-dynamic";

async function analyzeOne(symbol: string): Promise<StockAnalysisResponse | null> {
  try {
    const [quote, bars, fundamentals, quarterlyEps, institutional, margin, monthlyRevenue] =
      await Promise.all([
        stockDataProvider.getStockQuote(symbol),
        stockDataProvider.getStockHistory(symbol, "D", "5Y"),
        stockDataProvider.getFundamentals(symbol),
        stockDataProvider.getQuarterlyEps(symbol),
        stockDataProvider.getInstitutionalTrading(symbol),
        stockDataProvider.getMarginTrading(symbol),
        stockDataProvider.getMonthlyRevenue(symbol),
      ]);

    const technical = buildTechnicalIndicators(bars);
    const classification = classifyTechnical(bars, technical);
    const technicalAnalysis = buildTechnicalAnalysis(bars, technical, classification);
    const { breakdown: score, riskWarnings } = computeAIScore({
      bars,
      indicators: technical,
      fundamentals,
      quarterlyEps,
      institutional,
      margin,
    });
    const analysis = buildAIAnalysis(
      bars,
      technical,
      classification,
      fundamentals,
      quarterlyEps,
      institutional,
      score,
      riskWarnings
    );

    return {
      quote,
      technical,
      technicalAnalysis,
      score,
      analysis,
      institutional,
      fundamentals,
      quarterlyEps,
      monthlyRevenue,
      margin,
    };
  } catch {
    return null;
  }
}

/** Batch version of /api/stock/[symbol], used by the watchlist table. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbols = (searchParams.get("symbols") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const results = await Promise.all(symbols.map(analyzeOne));
  const analyses = results.filter((r): r is StockAnalysisResponse => r !== null);
  return NextResponse.json(analyses);
}
