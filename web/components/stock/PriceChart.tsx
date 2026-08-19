"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  type IChartApi,
} from "lightweight-charts";
import type { OhlcvBar } from "@/lib/types/stock";
import { calculateMASeries } from "@/services/analysis/technicalIndicators";

function toChartTime(date: string): string {
  // Monthly buckets are "YYYY-MM"; lightweight-charts needs a full date string.
  return date.length === 7 ? `${date}-01` : date;
}

const MA_LINES: { period: number; color: string }[] = [
  { period: 5, color: "#f59e0b" },
  { period: 20, color: "#3b82f6" },
  { period: 60, color: "#a855f7" },
];

export function PriceChart({ bars }: { bars: OhlcvBar[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Plain hex literals on purpose: lightweight-charts' color parser does
    // not understand the oklch()/lab() strings getComputedStyle returns for
    // our CSS custom properties, so it throws on construction if fed them.
    const isDark = document.documentElement.classList.contains("dark");
    const textColor = isDark ? "#e5e7eb" : "#111827";
    const gridColor = isDark ? "#334155" : "#e2e8f0";
    const upColor = isDark ? "#34d399" : "#059669";
    const downColor = isDark ? "#f87171" : "#dc2626";

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor,
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      rightPriceScale: { borderColor: gridColor },
      timeScale: { borderColor: gridColor },
      height: 380,
      autoSize: true,
    });
    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor,
      downColor,
      borderVisible: false,
      wickUpColor: upColor,
      wickDownColor: downColor,
    });
    candleSeries.setData(
      bars.map((b) => ({
        time: toChartTime(b.date),
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      }))
    );

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    volumeSeries.setData(
      bars.map((b) => ({
        time: toChartTime(b.date),
        value: b.volume,
        color: b.close >= b.open ? `${upColor}80` : `${downColor}80`,
      }))
    );

    for (const { period, color } of MA_LINES) {
      const series = calculateMASeries(bars, period);
      const maSeries = chart.addSeries(LineSeries, {
        color,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      maSeries.setData(
        bars
          .map((b, i) => ({ time: toChartTime(b.date), value: series[i] }))
          .filter((d): d is { time: string; value: number } => d.value !== null)
      );
    }

    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [bars]);

  return <div ref={containerRef} className="w-full" />;
}
