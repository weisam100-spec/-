import type { EquityPoint, TradeRecord } from "@/lib/backtest/types";

export function computeDrawdownSeries(equityCurve: EquityPoint[]): { time: number; drawdownPct: number }[] {
  let peak = equityCurve[0]?.equity ?? 0;
  return equityCurve.map((p) => {
    if (p.equity > peak) peak = p.equity;
    const drawdownPct = peak > 0 ? ((p.equity - peak) / peak) * 100 : 0;
    return { time: p.time, drawdownPct };
  });
}

export interface MonthlyReturnCell {
  year: number;
  month: number; // 1-12
  returnPct: number;
}

export function computeMonthlyReturns(equityCurve: EquityPoint[]): MonthlyReturnCell[] {
  if (equityCurve.length === 0) return [];
  const buckets = new Map<string, { first: number; last: number; year: number; month: number }>();
  for (const p of equityCurve) {
    const d = new Date(p.time);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const key = `${year}-${month}`;
    const existing = buckets.get(key);
    if (!existing) {
      buckets.set(key, { first: p.equity, last: p.equity, year, month });
    } else {
      existing.last = p.equity;
    }
  }
  return Array.from(buckets.values())
    .sort((a, b) => a.year - b.year || a.month - b.month)
    .map((b) => ({ year: b.year, month: b.month, returnPct: b.first > 0 ? ((b.last - b.first) / b.first) * 100 : 0 }));
}

export interface PnlBucket {
  label: string;
  count: number;
  isProfit: boolean;
}

export function computePnlBuckets(trades: TradeRecord[], bucketCount = 10): PnlBucket[] {
  if (trades.length === 0) return [];
  const pnls = trades.map((t) => t.returnPct);
  const min = Math.min(...pnls);
  const max = Math.max(...pnls);
  if (min === max) {
    return [{ label: `${min.toFixed(1)}%`, count: trades.length, isProfit: min >= 0 }];
  }
  const width = (max - min) / bucketCount;
  const buckets: PnlBucket[] = Array.from({ length: bucketCount }, (_, i) => {
    const from = min + i * width;
    const to = i === bucketCount - 1 ? max : min + (i + 1) * width;
    return { label: `${from.toFixed(1)}~${to.toFixed(1)}%`, count: 0, isProfit: from + to >= 0 };
  });
  for (const pnl of pnls) {
    let idx = Math.floor((pnl - min) / width);
    if (idx >= bucketCount) idx = bucketCount - 1;
    if (idx < 0) idx = 0;
    buckets[idx]!.count++;
  }
  return buckets;
}
