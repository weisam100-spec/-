import { AlertTriangle } from "lucide-react";
import type { AIAnalysisResult } from "@/lib/types/stock";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function Section({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl bg-muted p-4">
      <div className="mb-1.5 text-xs font-semibold text-muted-foreground">{title}</div>
      <p className="text-sm leading-relaxed">{text}</p>
    </div>
  );
}

export function AIAnalysisCard({ analysis }: { analysis: AIAnalysisResult }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>🧠 AI 投資分析</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Section title="趨勢判斷" text={analysis.trendSummary} />
        <Section title="技術面" text={analysis.technicalSummary} />
        <Section title="基本面" text={analysis.fundamentalSummary} />
        <Section title="籌碼面" text={analysis.chipSummary} />

        <div className="rounded-xl border border-amber-300/60 bg-amber-50 p-4 dark:border-amber-400/30 dark:bg-amber-950/40">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-200">
            <AlertTriangle className="size-3.5" />
            主要風險
          </div>
          {analysis.riskWarnings.length === 0 ? (
            <p className="text-sm text-amber-900 dark:text-amber-200">目前未偵測到明顯風險警訊。</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm text-amber-900 dark:text-amber-200">
              {analysis.riskWarnings.map((w) => (
                <li key={w}>⚠ {w}</li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          以上內容由系統依技術面／基本面／籌碼面規則自動整理產生，僅供研究參考，不構成投資建議。
        </p>
      </CardContent>
    </Card>
  );
}
