"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { searchKnownStocks } from "@/lib/constants/stocks";
import { cn } from "@/lib/utils";

export function StockSearchBar({ size = "default" }: { size?: "default" | "lg" }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);

  const suggestions = searchKnownStocks(value, 6);

  function go(symbol: string) {
    setOpen(false);
    setValue("");
    router.push(`/stock/${encodeURIComponent(symbol)}`);
  }

  function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    const exact = suggestions.find(
      (s) => s.symbol === trimmed || s.name === trimmed
    );
    go(exact ? exact.symbol : trimmed);
  }

  return (
    <div className="relative w-full">
      <div
        className={cn(
          "flex items-center gap-2 rounded-2xl border border-border bg-card px-4 shadow-sm",
          size === "lg" ? "h-14" : "h-10"
        )}
      >
        <Search className={cn("text-muted-foreground", size === "lg" ? "size-5" : "size-4")} />
        <Input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="輸入股票代號或公司名稱，例如 6213 聯茂"
          className={cn(
            "border-none bg-transparent px-0 shadow-none focus-visible:ring-0",
            size === "lg" && "text-base"
          )}
        />
        {size === "lg" && (
          <Button onClick={handleSubmit} className="shrink-0">
            搜尋
          </Button>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute top-full z-20 mt-2 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
          {suggestions.map((s) => (
            <button
              key={s.symbol}
              type="button"
              onMouseDown={() => go(s.symbol)}
              className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-accent"
            >
              <span className="font-medium">{s.name}</span>
              <span className="text-xs text-muted-foreground">{s.symbol}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
