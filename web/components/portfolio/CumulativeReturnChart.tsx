"use client";

import { useEffect, useRef } from "react";
import { createChart, ColorType, LineSeries, type IChartApi } from "lightweight-charts";
import type { PortfolioReturnPoint } from "@/lib/types/stock";

export function CumulativeReturnChart({ points }: { points: PortfolioReturnPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current || points.length === 0) return;

    const isDark = document.documentElement.classList.contains("dark");
    const textColor = isDark ? "#e5e7eb" : "#111827";
    const gridColor = isDark ? "#334155" : "#e2e8f0";
    const upColor = isDark ? "#34d399" : "#059669";
    const downColor = isDark ? "#f87171" : "#dc2626";
    const lastReturn = points[points.length - 1].returnPercent;
    const lineColor = lastReturn >= 0 ? upColor : downColor;

    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor },
      grid: { vertLines: { color: gridColor }, horzLines: { color: gridColor } },
      rightPriceScale: { borderColor: gridColor },
      timeScale: { borderColor: gridColor },
      height: 280,
      autoSize: true,
    });
    chartRef.current = chart;

    const zeroLine = chart.addSeries(LineSeries, {
      color: gridColor,
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    zeroLine.setData(points.map((p) => ({ time: p.date, value: 0 })));

    const returnSeries = chart.addSeries(LineSeries, {
      color: lineColor,
      lineWidth: 2,
      priceFormat: {
        type: "custom",
        formatter: (price: number) => `${price >= 0 ? "+" : ""}${price.toFixed(2)}%`,
        minMove: 0.01,
      },
    });
    returnSeries.setData(points.map((p) => ({ time: p.date, value: p.returnPercent })));

    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [points]);

  if (points.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
        尚無足夠資料繪製報酬曲線
      </div>
    );
  }

  return <div ref={containerRef} className="w-full" />;
}
