import type { AIScoreBreakdown } from "@/lib/types/stock";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function scoreColor(total: number) {
  if (total >= 65) return "#059669";
  if (total <= 40) return "#dc2626";
  return "#d97706";
}

function ScoreGauge({ total, size = 96 }: { total: number; size?: number }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(100, Math.max(0, total)) / 100);
  const color = scoreColor(total);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-muted)" strokeWidth={8} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="46%"
        textAnchor="middle"
        fontSize={size * 0.26}
        fontWeight={800}
        fill="currentColor"
      >
        {Math.round(total)}
      </text>
      <text x="50%" y="66%" textAnchor="middle" fontSize={size * 0.11} fill="var(--color-muted-foreground)">
        / 100
      </text>
    </svg>
  );
}

function BreakdownBar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-14 shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-foreground/70"
          style={{ width: `${(value / max) * 100}%` }}
        />
      </div>
      <span className="w-12 shrink-0 text-right text-xs font-medium">
        {value}/{max}
      </span>
    </div>
  );
}

export function AIScoreCard({ score }: { score: AIScoreBreakdown }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>🤖 AI 綜合分數</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="flex shrink-0 flex-col items-center gap-2">
          <div style={{ color: scoreColor(score.total) }}>
            <ScoreGauge total={score.total} />
          </div>
          <Badge variant={score.label === "偏多" ? "up" : score.label === "偏空" ? "down" : "muted"}>
            {score.label}
          </Badge>
        </div>
        <div className={cn("flex flex-1 flex-col gap-3")}>
          <BreakdownBar label="技術面" value={score.technical} max={30} />
          <BreakdownBar label="基本面" value={score.fundamental} max={30} />
          <BreakdownBar label="籌碼面" value={score.chip} max={20} />
          <BreakdownBar label="動能" value={score.momentum} max={10} />
          <BreakdownBar label="風險" value={score.risk} max={10} />
        </div>
      </CardContent>
    </Card>
  );
}
