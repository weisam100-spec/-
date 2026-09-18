"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LineChart } from "lucide-react";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/", label: "首頁儀表板" },
  { href: "/market", label: "行情與圖表" },
  { href: "/strategy", label: "策略設定" },
  { href: "/backtest", label: "回測結果" },
  { href: "/compare", label: "策略比較" },
  { href: "/portfolio", label: "模擬投資組合" },
  { href: "/watchlist", label: "觀察清單" },
  { href: "/about", label: "系統說明" },
];

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-[var(--color-bg)]/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-[var(--color-text)]">
          <LineChart className="h-5 w-5 text-[var(--color-accent)]" aria-hidden />
          <span className="text-sm font-bold tracking-wide">加密貨幣量化策略分析</span>
        </Link>
        <nav className="scrollbar-thin ml-2 flex flex-1 items-center gap-1 overflow-x-auto text-sm">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "whitespace-nowrap rounded-md px-2.5 py-1.5 transition",
                  active
                    ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
