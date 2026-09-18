"use client";

import { cn } from "@/lib/cn";

export interface SensitivityCellData {
  xValue: number;
  yValue: number;
  metricValue: number | null;
  tradeCount: number;
}

export function SensitivityHeatmap({
  cells,
  xLabel,
  yLabel,
  metricLabel,
}: {
  cells: SensitivityCellData[];
  xLabel: string;
  yLabel: string;
  metricLabel: string;
}) {
  if (cells.length === 0) return null;
  const xValues = Array.from(new Set(cells.map((c) => c.xValue))).sort((a, b) => a - b);
  const yValues = Array.from(new Set(cells.map((c) => c.yValue))).sort((a, b) => a - b);
  const values = cells.map((c) => c.metricValue).filter((v): v is number => v !== null);
  const maxAbs = Math.max(1e-9, ...values.map((v) => Math.abs(v)));
  const lookup = new Map(cells.map((c) => [`${c.xValue}-${c.yValue}`, c]));

  function colorFor(v: number | null) {
    if (v === null) return "bg-[var(--color-surface-raised)] text-[var(--color-text-muted)]";
    const ratio = Math.min(1, Math.abs(v) / maxAbs);
    if (v > 0) return ratio > 0.5 ? "bg-[var(--color-up)] text-black" : "bg-[var(--color-up-soft)] text-[var(--color-up)]";
    if (v < 0) return ratio > 0.5 ? "bg-[var(--color-down)] text-white" : "bg-[var(--color-down-soft)] text-[var(--color-down)]";
    return "bg-[var(--color-surface-raised)] text-[var(--color-text-muted)]";
  }

  return (
    <div className="scrollbar-thin overflow-x-auto">
      <p className="mb-2 text-xs text-[var(--color-text-muted)]">
        橫軸：{xLabel}　縱軸：{yLabel}　顏色深淺代表「{metricLabel}」數值，僅反映所選歷史區間，不代表未來表現。
      </p>
      <table className="border-separate border-spacing-1 text-center text-xs">
        <thead>
          <tr>
            <th></th>
            {xValues.map((x) => (
              <th key={x} className="px-1 font-normal text-[var(--color-text-muted)]">
                {x}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {yValues.map((y) => (
            <tr key={y}>
              <td className="pr-1 text-right font-medium text-[var(--color-text-muted)]">{y}</td>
              {xValues.map((x) => {
                const cell = lookup.get(`${x}-${y}`);
                const v = cell?.metricValue ?? null;
                return (
                  <td key={x} className={cn("min-w-[56px] rounded px-1.5 py-2", colorFor(v))} title={cell ? `交易筆數：${cell.tradeCount}` : ""}>
                    {v === null ? "—" : v.toFixed(1)}
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
