import type { TechnicalAnalysisResult, TechnicalIndicators } from "@/lib/types/stock";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

const MA_ROWS: { key: keyof TechnicalIndicators["ma"]; label: string; above: keyof TechnicalAnalysisResult }[] = [
  { key: "ma5", label: "MA5", above: "aboveMa5" },
  { key: "ma10", label: "MA10", above: "aboveMa5" },
  { key: "ma20", label: "MA20", above: "aboveMa20" },
  { key: "ma60", label: "MA60", above: "aboveMa60" },
  { key: "ma120", label: "MA120", above: "aboveMa120" },
  { key: "ma240", label: "MA240", above: "aboveMa240" },
];

function trendBadgeVariant(pattern: string) {
  if (pattern === "多頭排列") return "up" as const;
  if (pattern === "空頭排列") return "down" as const;
  return "muted" as const;
}

export function TechnicalAnalysisPanel({
  technical,
  technicalAnalysis,
}: {
  technical: TechnicalIndicators;
  technicalAnalysis: TechnicalAnalysisResult;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>均線排列</CardTitle>
          <Badge variant={trendBadgeVariant(technicalAnalysis.trendPattern)}>
            {technicalAnalysis.trendPattern}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {MA_ROWS.map(({ key, label, above }) => {
              const value = technical.ma[key];
              const isAbove = technicalAnalysis[above] as boolean;
              return (
                <div key={key} className="rounded-lg bg-muted p-3">
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="text-sm font-bold">
                    {value === null ? "資料不足" : formatNumber(value, 1)}
                  </div>
                  {value !== null && (
                    <div className={cn("text-xs font-medium", isAbove ? "text-up" : "text-down")}>
                      {isAbove ? "站上" : "站下"}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>RSI</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold">{technical.rsi14}</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {technicalAnalysis.rsiZone === "overbought" && "可能進入過熱區（RSI > 70）"}
              {technicalAnalysis.rsiZone === "oversold" && "可能進入超賣區（RSI < 30）"}
              {technicalAnalysis.rsiZone === "neutral" && "中性區間（30 ～ 70）"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>MACD</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            <div>DIF：{technical.macd.dif}</div>
            <div>MACD：{technical.macd.macd}</div>
            <div>OSC：{technical.macd.osc}</div>
            <Badge
              className="mt-1 w-fit"
              variant={
                technical.macd.signal === "golden_cross" || technical.macd.signal === "bullish"
                  ? "up"
                  : technical.macd.signal === "death_cross" || technical.macd.signal === "bearish"
                    ? "down"
                    : "muted"
              }
            >
              {
                {
                  golden_cross: "黃金交叉",
                  death_cross: "死亡交叉",
                  bullish: "多方動能",
                  bearish: "空方動能",
                  neutral: "中性",
                }[technical.macd.signal]
              }
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>KD</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            <div>K值：{technical.kd.k}</div>
            <div>D值：{technical.kd.d}</div>
            <Badge
              className="mt-1 w-fit"
              variant={
                technical.kd.signal === "golden_cross" || technical.kd.signal === "oversold"
                  ? "up"
                  : technical.kd.signal === "death_cross" || technical.kd.signal === "overbought"
                    ? "down"
                    : "muted"
              }
            >
              {
                {
                  golden_cross: "黃金交叉",
                  death_cross: "死亡交叉",
                  overbought: "超買",
                  oversold: "超賣",
                  neutral: "中性",
                }[technical.kd.signal]
              }
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>成交量分析</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            <div>今日成交量：{formatNumber(technical.volumeStats.today, 0)} 張</div>
            <div>20日均量：{formatNumber(technical.volumeStats.avg20, 0)} 張</div>
            <div>量能倍率：{technical.volumeStats.ratioVsAvg20.toFixed(2)} 倍</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-2 p-4 text-sm leading-relaxed">
          <p>{technicalAnalysis.narrative}</p>
          <p className="text-muted-foreground">{technicalAnalysis.volumeNarrative}</p>
        </CardContent>
      </Card>
    </div>
  );
}
