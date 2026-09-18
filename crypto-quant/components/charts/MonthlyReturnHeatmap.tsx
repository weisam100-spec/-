"use client";

import { computeMonthlyReturns } from "@/lib/client/deriveCharts";
import type { EquityPoint } from "@/lib/backtest/types";
import { cn } from "@/lib/cn";

const MONTH_LABEL = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

function cellColor(returnPct: number): string {
  if (returnPct > 8) return "bg-[var(--color-up)] text-black";
  if (returnPct > 0) return "bg-[var(--color-up-soft)] text-[var(--color-up)]";
  if (returnPct < -8) return "bg-[var(--color-down)] text-white";
  if (returnPct < 0) return "bg-[var(--color-down-soft)] text-[var(--color-down)]";
  return "bg-[var(--color-surface-raised)] text-[var(--color-text-muted)]";
}

export function MonthlyReturnHeatmap({ data }: { data: EquityPoint[] }) {
  const cells = computeMonthlyReturns(data);
  if (cells.length === 0) return null;
  const years = Array.from(new Set(cells.map((c) => c.year))).sort();
  const lookup = new Map(cells.map((c) => [`${c.year}-${c.month}`, c.returnPct]));

  return (
    <div className="scrollbar-thin overflow-x-auto">
      <table className="w-full min-w-[560px] border-separate border-spacing-1 text-center text-xs">
        <thead>
          <tr>
            <th className="text-left text-[var(--color-text-muted)]">年份</th>
            {MONTH_LABEL.map((m) => (
              <th key={m} className="font-normal text-[var(--color-text-muted)]">
                {m}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {years.map((year) => (
            <tr key={year}>
              <td className="text-left font-medium text-[var(--color-text)]">{year}</td>
              {MONTH_LABEL.map((_, idx) => {
                const month = idx + 1;
                const val = lookup.get(`${year}-${month}`);
                return (
                  <td key={month} className={cn("rounded px-1.5 py-1.5", val === undefined ? "bg-transparent" : cellColor(val))}>
                    {val === undefined ? "" : `${val > 0 ? "+" : ""}${val.toFixed(1)}%`}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
