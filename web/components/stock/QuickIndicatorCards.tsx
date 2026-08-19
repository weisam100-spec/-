import type { TechnicalIndicators, TechnicalAnalysisResult } from "@/lib/types/stock";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const MACD_LABEL = {
  golden_cross: "黃金交叉",
  death_cross: "死亡交叉",
  bullish: "多方動能",
  bearish: "空方動能",
  neutral: "中性",
} as const;

const KD_LABEL = {
  golden_cross: "黃金交叉",
  death_cross: "死亡交叉",
  overbought: "超買",
  oversold: "超賣",
  neutral: "中性",
} as const;

function MiniCard({ title, value, badge }: { title: string; value: string; badge?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <span className="text-xs text-muted-foreground">{title}</span>
        <span className="text-lg font-bold">{value}</span>
        {badge}
      </CardContent>
    </Card>
  );
}

export function QuickIndicatorCards({
  technical,
  technicalAnalysis,
}: {
  technical: TechnicalIndicators;
  technicalAnalysis: TechnicalAnalysisResult;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <MiniCard
        title="均線排列"
        value={technicalAnalysis.trendPattern}
        badge={
          <Badge
            variant={
              technicalAnalysis.trendPattern === "多頭排列"
                ? "up"
                : technicalAnalysis.trendPattern === "空頭排列"
                  ? "down"
                  : "muted"
            }
          >
            {technical.ma.ma20 !== null && technical.ma.ma60 !== null
              ? `MA20 ${technical.ma.ma20} / MA60 ${technical.ma.ma60}`
              : "資料累積中"}
          </Badge>
        }
      />
      <MiniCard
        title="RSI(14)"
        value={String(technical.rsi14)}
        badge={
          <Badge variant={technicalAnalysis.rsiZone === "neutral" ? "muted" : "down"}>
            {technicalAnalysis.rsiZone === "overbought" && "過熱"}
            {technicalAnalysis.rsiZone === "oversold" && "超賣"}
            {technicalAnalysis.rsiZone === "neutral" && "中性"}
          </Badge>
        }
      />
      <MiniCard
        title="MACD"
        value={`OSC ${technical.macd.osc}`}
        badge={
          <Badge variant={technical.macd.osc >= 0 ? "up" : "down"}>
            {MACD_LABEL[technical.macd.signal]}
          </Badge>
        }
      />
      <MiniCard
        title="KD"
        value={`K${technical.kd.k} D${technical.kd.d}`}
        badge={
          <Badge variant={technical.kd.k >= technical.kd.d ? "up" : "down"}>
            {KD_LABEL[technical.kd.signal]}
          </Badge>
        }
      />
    </div>
  );
}
