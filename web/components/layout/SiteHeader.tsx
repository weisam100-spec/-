import Link from "next/link";
import { LineChart } from "lucide-react";
import { StockSearchBar } from "@/components/search/StockSearchBar";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-bold">
          <LineChart className="size-5" />
          <span className="hidden sm:inline">AI 台股投資分析助手</span>
          <span className="sm:hidden">AI 台股助手</span>
        </Link>
        <div className="hidden max-w-md flex-1 sm:block">
          <StockSearchBar />
        </div>
        <nav className="ml-auto flex items-center gap-4 text-sm font-medium text-muted-foreground">
          <Link href="/watchlist" className="hover:text-foreground">
            自選股
          </Link>
          <Link href="/portfolio" className="hover:text-foreground">
            我的持股
          </Link>
        </nav>
      </div>
      <div className="px-4 pb-3 sm:hidden">
        <StockSearchBar />
      </div>
    </header>
  );
}
