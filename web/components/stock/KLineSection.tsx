"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { PriceChart } from "@/components/stock/PriceChart";
import { useStockHistory } from "@/hooks/useStockHistory";
import type { KLineInterval, KLineRange } from "@/lib/types/stock";
import { cn } from "@/lib/utils";

const INTERVALS: { value: KLineInterval; label: string }[] = [
  { value: "D", label: "日K" },
  { value: "W", label: "週K" },
  { value: "M", label: "月K" },
];

const RANGES: { value: KLineRange; label: string }[] = [
  { value: "1M", label: "1個月" },
  { value: "3M", label: "3個月" },
  { value: "6M", label: "6個月" },
  { value: "1Y", label: "1年" },
  { value: "3Y", label: "3年" },
  { value: "5Y", label: "5年" },
];

function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium transition-colors",
            value === opt.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function KLineSection({ symbol }: { symbol: string }) {
  const [klineInterval, setKlineInterval] = useState<KLineInterval>("D");
  const [klineRange, setKlineRange] = useState<KLineRange>("6M");
  const { data: bars, isLoading } = useStockHistory(symbol, klineInterval, klineRange);

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ToggleGroup options={INTERVALS} value={klineInterval} onChange={setKlineInterval} />
          <ToggleGroup options={RANGES} value={klineRange} onChange={setKlineRange} />
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <LegendDot color="#f59e0b" label="MA5" />
          <LegendDot color="#3b82f6" label="MA20" />
          <LegendDot color="#a855f7" label="MA60" />
        </div>
        {isLoading || !bars ? (
          <div className="h-[380px] animate-pulse rounded-xl bg-muted" />
        ) : bars.length === 0 ? (
          <div className="flex h-[380px] items-center justify-center text-sm text-muted-foreground">
            此區間尚無資料
          </div>
        ) : (
          <PriceChart bars={bars} />
        )}
      </CardContent>
    </Card>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

