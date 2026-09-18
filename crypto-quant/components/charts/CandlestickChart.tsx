"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle } from "@/lib/market/types";
import type { StrategySignal } from "@/lib/strategies/types";

export interface OverlayLine {
  name: string;
  color: string;
  data: { time: number; value: number }[];
}

export function CandlestickChart({
  candles,
  overlays = [],
  signals = [],
  height = 380,
}: {
  candles: Candle[];
  overlays?: OverlayLine[];
  signals?: StrategySignal[];
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: { background: { color: "transparent" }, textColor: "#8a93a3", fontSize: 11 },
      grid: {
        vertLines: { color: "#1a212c" },
        horzLines: { color: "#1a212c" },
      },
      rightPriceScale: { borderColor: "#232b38" },
      timeScale: { borderColor: "#232b38", timeVisible: true, secondsVisible: false },
      crosshair: { mode: 0 },
      autoSize: true,
      height,
    });
    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#16c784",
      downColor: "#ea3943",
      borderVisible: false,
      wickUpColor: "#16c784",
      wickDownColor: "#ea3943",
    });
    candleSeries.setData(
      candles.map((c) => ({
        time: Math.floor(c.openTime / 1000) as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
      color: "#3b4252",
    });
    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
    volumeSeries.setData(
      candles.map((c) => ({
        time: Math.floor(c.openTime / 1000) as UTCTimestamp,
        value: c.volume,
        color: c.close >= c.open ? "rgba(22,199,132,0.45)" : "rgba(234,57,67,0.45)",
      })),
    );

    for (const overlay of overlays) {
      const line = chart.addSeries(LineSeries, {
        color: overlay.color,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        title: overlay.name,
      });
      line.setData(
        overlay.data
          .filter((d) => Number.isFinite(d.value))
          .map((d) => ({ time: Math.floor(d.time / 1000) as UTCTimestamp, value: d.value })),
      );
    }

    if (signals.length > 0) {
      const markersPlugin = createSeriesMarkers(candleSeries, []);
      markersPlugin.setMarkers(
        signals.map((s) => ({
          time: Math.floor(s.time / 1000) as UTCTimestamp,
          position: s.type === "bullish_candidate" ? "belowBar" : "aboveBar",
          color:
            s.type === "bullish_candidate"
              ? "#16c784"
              : s.type === "bearish_candidate"
                ? "#ea3943"
                : s.type === "risk_up"
                  ? "#f2a900"
                  : "#8a93a3",
          shape: s.type === "bullish_candidate" ? "arrowUp" : s.type === "bearish_candidate" ? "arrowDown" : "circle",
          text: s.type === "bullish_candidate" ? "偏多" : s.type === "bearish_candidate" ? "偏空" : s.type === "risk_up" ? "風險" : "觀望",
        })),
      );
    }

    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [candles, overlays, signals, height]);

  return <div ref={containerRef} className="w-full" style={{ height }} />;
}
