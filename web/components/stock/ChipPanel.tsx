import type { InstitutionalTrading, MarginTrading } from "@/lib/types/stock";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatNumber, formatSigned } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

function NetRow({
  label,
  today,
  last5d,
  last20d,
}: {
  label: string;
  today: number;
  last5d: number;
  last20d: number;
}) {
  const cell = (v: number) => (
    <span className={cn("font-semibold", v >= 0 ? "text-up" : "text-down")}>
      {formatSigned(v, 0)} 張
    </span>
  );
  return (
    <div className="grid grid-cols-4 items-center gap-2 border-b border-border py-2.5 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      {cell(today)}
      {cell(last5d)}
      {cell(last20d)}
    </div>
  );
}

export function ChipPanel({
  institutional,
  margin,
}: {
  institutional: InstitutionalTrading;
  margin: MarginTrading;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>籌碼分析（三大法人買賣超）</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-2 border-b border-border pb-2 text-xs font-medium text-muted-foreground">
            <span>法人</span>
            <span>今日</span>
            <span>近5日</span>
            <span>近20日</span>
          </div>
          <NetRow label="外資" today={institutional.foreign.today} last5d={institutional.foreign.last5d} last20d={institutional.foreign.last20d} />
          <NetRow label="投信" today={institutional.trust.today} last5d={institutional.trust.last5d} last20d={institutional.trust.last20d} />
          <NetRow label="自營商" today={institutional.dealer.today} last5d={institutional.dealer.last5d} last20d={institutional.dealer.last20d} />
          <p className="mt-3 text-sm text-muted-foreground">{institutional.narrative}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>融資融券</CardTitle>
          <div className="flex flex-wrap gap-1.5">
            {margin.flags.map((f) => (
              <Badge key={f} variant="muted">
                {f}
              </Badge>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-lg bg-muted p-3">
              <div className="text-xs text-muted-foreground">融資餘額</div>
              <div className="text-lg font-bold">{formatNumber(margin.marginBalance, 0)} 張</div>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <div className="text-xs text-muted-foreground">融資增減</div>
              <div className={cn("text-lg font-bold", margin.marginChange >= 0 ? "text-up" : "text-down")}>
                {formatSigned(margin.marginChange, 0)}
              </div>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <div className="text-xs text-muted-foreground">融券餘額</div>
              <div className="text-lg font-bold">{formatNumber(margin.shortBalance, 0)} 張</div>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <div className="text-xs text-muted-foreground">融券增減</div>
              <div className={cn("text-lg font-bold", margin.shortChange >= 0 ? "text-up" : "text-down")}>
                {formatSigned(margin.shortChange, 0)}
              </div>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <div className="text-xs text-muted-foreground">券資比</div>
              <div className="text-lg font-bold">{margin.shortMarginRatio.toFixed(2)}%</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
