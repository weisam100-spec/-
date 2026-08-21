import type { PortfolioSummary } from "@/lib/types/stock";
import { Card, CardContent } from "@/components/ui/card";
import { formatNumber, formatPercent, formatSigned } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "up" | "down";
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span
          className={cn(
            "text-xl font-bold",
            tone === "up" && "text-up",
            tone === "down" && "text-down"
          )}
        >
          {value}
        </span>
      </CardContent>
    </Card>
  );
}

export function PortfolioSummaryCards({ summary }: { summary: PortfolioSummary }) {
  const plUp = summary.totalUnrealizedPL >= 0;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard label="總成本" value={formatNumber(summary.totalCost, 0)} />
      <StatCard label="目前市值" value={formatNumber(summary.totalMarketValue, 0)} />
      <StatCard
        label="未實現損益"
        tone={plUp ? "up" : "down"}
        value={formatSigned(summary.totalUnrealizedPL, 0)}
      />
      <StatCard
        label="總報酬率"
        tone={plUp ? "up" : "down"}
        value={formatPercent(summary.totalReturnPercent)}
      />
    </div>
  );
}
