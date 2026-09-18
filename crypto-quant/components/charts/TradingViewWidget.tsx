"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { Interval } from "@/lib/market/symbols";

// TradingView Advanced Real-Time Chart widget（官方免費嵌入元件，非付費 Charting Library）
// 文件：https://www.tradingview.com/widget/advanced-chart/
// 僅嵌入官方公開 widget，不涉及任何金鑰或帳號串接。

const TV_INTERVAL: Record<Interval, string> = {
  "5m": "5",
  "15m": "15",
  "1h": "60",
  "4h": "240",
  "1d": "D",
};

declare global {
  interface Window {
    TradingView?: {
      widget: new (options: Record<string, unknown>) => unknown;
    };
  }
}

let scriptLoadPromise: Promise<void> | null = null;

function loadTradingViewScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.TradingView) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptLoadPromise = null;
      reject(new Error("TradingView 圖表元件載入失敗"));
    };
    document.head.appendChild(script);
  });
  return scriptLoadPromise;
}

export function TradingViewWidget({
  symbol,
  interval,
  height = 500,
}: {
  symbol: string;
  interval: Interval;
  height?: number;
}) {
  const rawId = useId();
  const containerId = `tv-widget-${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");

    loadTradingViewScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.TradingView) return;
        containerRef.current.innerHTML = "";
        new window.TradingView.widget({
          autosize: true,
          symbol: `BINANCE:${symbol}`,
          interval: TV_INTERVAL[interval],
          timezone: "Asia/Taipei",
          theme: "dark",
          style: "1",
          locale: "zh_TW",
          toolbar_bg: "#10161f",
          backgroundColor: "#0a0e14",
          gridColor: "rgba(35, 43, 56, 0.6)",
          enable_publishing: false,
          allow_symbol_change: false,
          hide_top_toolbar: false,
          hide_legend: false,
          withdateranges: true,
          container_id: containerId,
        });
        if (!cancelled) setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [symbol, interval, containerId]);

  return (
    <div className="relative w-full" style={{ height }}>
      {status === "loading" && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[var(--color-surface)] text-[var(--color-text-muted)]">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
          <p className="text-sm">正在載入 TradingView 圖表…</p>
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[var(--color-surface)] text-center text-[var(--color-text-muted)]">
          <p className="text-sm text-[var(--color-down)]">TradingView 圖表載入失敗</p>
          <p className="text-xs">請確認網路連線可連到 tradingview.com 後重新整理頁面</p>
        </div>
      )}
      <div id={containerId} ref={containerRef} className="h-full w-full" />
    </div>
  );
}
