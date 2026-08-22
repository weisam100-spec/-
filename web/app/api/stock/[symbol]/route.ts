import { NextResponse } from "next/server";
import type { StockAnalysisResponse } from "@/lib/types/stock";
import { stockDataProvider } from "@/services/providers";
import { StockNotFoundError } from "@/services/providers/StockDataProvider";
import { FinMindRequestError } from "@/services/providers/finmind/client";
import { buildTechnicalIndicators, classifyTechnical } from "@/services/analysis/technicalIndicators";
import { computeAIScore } from "@/services/analysis/aiScore";
import { buildAIAnalysis, buildTechnicalAnalysis } from "@/services/analysis/aiNarrative";

// Always computed per-request (live fetch and/or date-seeded mock data).
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;

  try {
    // Fetch a long daily series so MA120/MA240 always have enough bars,
    // independent of whatever range the chart UI happens to be showing.
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

    const response: StockAnalysisResponse = {
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
    return NextResponse.json(response);
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
