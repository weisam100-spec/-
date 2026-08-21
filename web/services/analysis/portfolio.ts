import type {
  HoldingItem,
  HoldingMetrics,
  KLineRange,
  OhlcvBar,
  PortfolioReturnPoint,
  PortfolioSummary,
} from "@/lib/types/stock";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Used when a holding has no purchaseDate set, so the return curve still has a sensible window. */
export const DEFAULT_LOOKBACK_DAYS = 90;

export function defaultPurchaseDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - DEFAULT_LOOKBACK_DAYS);
  return d.toISOString().slice(0, 10);
}

const RANGE_DAYS_APPROX: Record<KLineRange, number> = {
  "1M": 31,
  "3M": 93,
  "6M": 186,
  "1Y": 366,
  "3Y": 1097,
  "5Y": 1828,
};
const RANGE_ORDER: KLineRange[] = ["1M", "3M", "6M", "1Y", "3Y", "5Y"];

/** Smallest preset K-line range that comfortably covers from `purchaseDate` to today. */
export function pickRangeCovering(purchaseDate: string | undefined): KLineRange {
  const start = purchaseDate ? new Date(purchaseDate) : new Date(Date.now() - DEFAULT_LOOKBACK_DAYS * 86_400_000);
  const daysAgo = Math.ceil((Date.now() - start.getTime()) / 86_400_000);
  for (const range of RANGE_ORDER) {
    if (RANGE_DAYS_APPROX[range] >= daysAgo) return range;
  }
  return "5Y";
}

export function computeHoldingMetrics(holding: HoldingItem, currentPrice: number): HoldingMetrics {
  const costBasis = round2(holding.avgCost * holding.shares);
  const marketValue = round2(currentPrice * holding.shares);
  const unrealizedPL = round2(marketValue - costBasis);
  const returnPercent = costBasis !== 0 ? round2((unrealizedPL / costBasis) * 100) : 0;
  return { symbol: holding.symbol, costBasis, marketValue, unrealizedPL, returnPercent };
}

export function computePortfolioSummary(metrics: HoldingMetrics[]): PortfolioSummary {
  const totalCost = round2(metrics.reduce((sum, m) => sum + m.costBasis, 0));
  const totalMarketValue = round2(metrics.reduce((sum, m) => sum + m.marketValue, 0));
  const totalUnrealizedPL = round2(totalMarketValue - totalCost);
  const totalReturnPercent = totalCost !== 0 ? round2((totalUnrealizedPL / totalCost) * 100) : 0;
  return { totalCost, totalMarketValue, totalUnrealizedPL, totalReturnPercent };
}

/**
 * Combines each holding's own historical daily bars into a single portfolio-level
 * cumulative return curve. Holdings enter the curve on their own purchaseDate (or
 * the shared default lookback if unset), and each holding's price is forward-filled
 * from its own most recent known bar so gaps in one symbol's data don't zero out
 * the whole portfolio for that day.
 */
export function computePortfolioReturnSeries(
  holdings: HoldingItem[],
  historiesBySymbol: Record<string, OhlcvBar[]>
): PortfolioReturnPoint[] {
  const perHolding = holdings.map((holding) => ({
    holding,
    bars: [...(historiesBySymbol[holding.symbol] ?? [])].sort((a, b) => (a.date < b.date ? -1 : 1)),
    start: holding.purchaseDate || defaultPurchaseDate(),
  }));

  const allDates = new Set<string>();
  for (const p of perHolding) {
    for (const bar of p.bars) {
      if (bar.date >= p.start) allDates.add(bar.date);
    }
  }
  const sortedDates = Array.from(allDates).sort();
  const pointers = new Map(perHolding.map((p) => [p.holding.symbol, 0]));

  const points: PortfolioReturnPoint[] = [];
  for (const date of sortedDates) {
    let cost = 0;
    let value = 0;
    for (const p of perHolding) {
      if (date < p.start || p.bars.length === 0) continue;
      cost += p.holding.avgCost * p.holding.shares;

      let idx = pointers.get(p.holding.symbol)!;
      while (idx + 1 < p.bars.length && p.bars[idx + 1].date <= date) idx++;
      pointers.set(p.holding.symbol, idx);

      const bar = p.bars[idx];
      if (bar && bar.date <= date) {
        value += bar.close * p.holding.shares;
      }
    }
    if (cost > 0) {
      points.push({
        date,
        cost: round2(cost),
        value: round2(value),
        returnPercent: round2(((value - cost) / cost) * 100),
      });
    }
  }
  return points;
}
