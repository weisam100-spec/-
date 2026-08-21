"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { usePortfolio } from "@/hooks/usePortfolio";
import { searchKnownStocks, findKnownStock } from "@/lib/constants/stocks";
import { DEFAULT_LOOKBACK_DAYS, defaultPurchaseDate } from "@/services/analysis/portfolio";

export function AddHoldingForm() {
  const { add } = usePortfolio();
  const [symbolInput, setSymbolInput] = useState("");
  const [open, setOpen] = useState(false);
  const [avgCost, setAvgCost] = useState("");
  const [shares, setShares] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [error, setError] = useState("");

  const suggestions = searchKnownStocks(symbolInput, 6);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const stock = findKnownStock(symbolInput.trim());
    if (!stock) {
      setError("請從清單中選擇有效的股票代號或名稱");
      return;
    }
    const cost = Number(avgCost);
    const shareCount = Number(shares);
    if (!(cost > 0)) {
      setError("平均成本需為正數");
      return;
    }
    if (!(shareCount > 0)) {
      setError("持有股數需為正數");
      return;
    }

    add({
      symbol: stock.symbol,
      name: stock.name,
      avgCost: cost,
      shares: shareCount,
      purchaseDate: purchaseDate || undefined,
    });

    setSymbolInput("");
    setAvgCost("");
    setShares("");
    setPurchaseDate("");
  }

  return (
    <Card>
      <CardContent className="p-4">
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
          <div className="relative w-40">
            <label className="mb-1 block text-xs text-muted-foreground">股票代號/名稱</label>
            <Input
              value={symbolInput}
              onChange={(e) => {
                setSymbolInput(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              placeholder="例如 6213"
            />
            {open && suggestions.length > 0 && (
              <div className="absolute top-full z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
                {suggestions.map((s) => (
                  <button
                    key={s.symbol}
                    type="button"
                    onMouseDown={() => {
                      setSymbolInput(s.symbol);
                      setOpen(false);
                    }}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    <span>{s.name}</span>
                    <span className="text-xs text-muted-foreground">{s.symbol}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="w-28">
            <label className="mb-1 block text-xs text-muted-foreground">平均成本</label>
            <Input
              type="number"
              inputMode="decimal"
              value={avgCost}
              onChange={(e) => setAvgCost(e.target.value)}
              placeholder="370"
            />
          </div>

          <div className="w-28">
            <label className="mb-1 block text-xs text-muted-foreground">持有股數</label>
            <Input
              type="number"
              inputMode="numeric"
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              placeholder="6000"
            />
          </div>

          <div className="w-40">
            <label className="mb-1 block text-xs text-muted-foreground">
              買入日期（選填，預設近 {DEFAULT_LOOKBACK_DAYS} 天）
            </label>
            <Input
              type="date"
              value={purchaseDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setPurchaseDate(e.target.value)}
            />
          </div>

          <Button type="submit">+ 新增持股</Button>
        </form>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        {!purchaseDate && (
          <p className="mt-2 text-xs text-muted-foreground">
            未填買入日期時，報酬曲線預設從 {defaultPurchaseDate()} 開始估算。
          </p>
        )}
      </CardContent>
    </Card>
  );
}
