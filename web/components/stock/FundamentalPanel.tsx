import type { FundamentalData, MonthlyRevenue, QuarterlyEps } from "@/lib/types/stock";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EpsBarChart } from "@/components/stock/EpsBarChart";
import { RevenueTrendChart } from "@/components/stock/RevenueTrendChart";
import { buildRevenueNarrative } from "@/services/analysis/aiNarrative";
import { formatNumber, formatPercent } from "@/lib/utils/format";

function RatioTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

export function FundamentalPanel({
  fundamentals,
  quarterlyEps,
  monthlyRevenue,
}: {
  fundamentals: FundamentalData;
  quarterlyEps: QuarterlyEps[];
  monthlyRevenue: MonthlyRevenue[];
}) {
  const latestRevenue = monthlyRevenue[monthlyRevenue.length - 1];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>基本面比率</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <RatioTile label="EPS" value={fundamentals.eps.toFixed(2)} />
            <RatioTile label="本益比 PE" value={fundamentals.pe.toFixed(1)} />
            <RatioTile label="股價淨值比 PB" value={fundamentals.pb.toFixed(2)} />
            <RatioTile label="ROE" value={formatPercent(fundamentals.roe)} />
            <RatioTile label="毛利率" value={formatPercent(fundamentals.grossMargin)} />
            <RatioTile label="營業利益率" value={formatPercent(fundamentals.operatingMargin)} />
            <RatioTile label="稅後淨利率" value={formatPercent(fundamentals.netMargin)} />
            <RatioTile label="毛利率趨勢" value={{ up: "上升", flat: "持平", down: "下滑" }[fundamentals.grossMarginTrend]} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>月營收趨勢（近 {monthlyRevenue.length} 個月）</CardTitle>
          {latestRevenue && (
            <Badge variant={latestRevenue.yoy >= 0 ? "up" : "down"}>
              YoY {formatPercent(latestRevenue.yoy)}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {latestRevenue && (
            <div className="flex flex-wrap gap-6 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">{latestRevenue.month} 營收</div>
                <div className="text-xl font-bold">{formatNumber(latestRevenue.revenue / 1_0000_0000, 2)} 億</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">MoM</div>
                <div className={latestRevenue.mom >= 0 ? "text-up font-semibold" : "text-down font-semibold"}>
                  {formatPercent(latestRevenue.mom)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">YoY</div>
                <div className={latestRevenue.yoy >= 0 ? "text-up font-semibold" : "text-down font-semibold"}>
                  {formatPercent(latestRevenue.yoy)}
                </div>
              </div>
            </div>
          )}
          <RevenueTrendChart data={monthlyRevenue} />
          <p className="text-sm text-muted-foreground">{buildRevenueNarrative(latestRevenue)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>近 {quarterlyEps.length} 季 EPS</CardTitle>
        </CardHeader>
        <CardContent>
          <EpsBarChart data={quarterlyEps} />
        </CardContent>
      </Card>
    </div>
  );
}
