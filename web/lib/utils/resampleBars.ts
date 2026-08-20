import type { OhlcvBar } from "@/lib/types/stock";

/** Groups daily bars into weekly buckets keyed by the Monday of each week. */
export function resampleWeekly(bars: OhlcvBar[]): OhlcvBar[] {
  return resampleByBucket(bars, (d) => {
    const date = new Date(d);
    const day = date.getDay();
    const monday = new Date(date);
    monday.setDate(date.getDate() - ((day + 6) % 7));
    return monday.toISOString().slice(0, 10);
  });
}

/** Groups daily bars into monthly buckets keyed by "YYYY-MM". */
export function resampleMonthly(bars: OhlcvBar[]): OhlcvBar[] {
  return resampleByBucket(bars, (d) => d.slice(0, 7));
}

export function resampleByBucket(
  bars: OhlcvBar[],
  bucketKey: (date: string) => string
): OhlcvBar[] {
  const buckets = new Map<string, OhlcvBar[]>();
  for (const bar of bars) {
    const key = bucketKey(bar.date);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(bar);
  }
  return Array.from(buckets.entries()).map(([key, group]) => ({
    date: key,
    open: group[0].open,
    high: Math.max(...group.map((b) => b.high)),
    low: Math.min(...group.map((b) => b.low)),
    close: group[group.length - 1].close,
    volume: group.reduce((sum, b) => sum + b.volume, 0),
  }));
}
