import type { QuarterlyEps } from "@/lib/types/stock";
import { cn } from "@/lib/utils";

export function EpsBarChart({ data }: { data: QuarterlyEps[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">尚無季度 EPS 資料。</p>;
  }
  const max = Math.max(...data.map((d) => Math.abs(d.eps)), 0.1);

  return (
    <div className="flex h-44 gap-3">
      {data.map((d) => (
        <div key={d.quarter} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
          <span className="text-xs font-semibold">{d.eps.toFixed(2)}</span>
          <div
            className={cn("w-full rounded-t-md", d.eps >= 0 ? "bg-up" : "bg-down")}
            style={{ height: `${Math.max((Math.abs(d.eps) / max) * 100, 4)}%` }}
          />
          <span className="whitespace-nowrap text-[10px] text-muted-foreground">
            {d.quarter}
          </span>
        </div>
      ))}
    </div>
  );
}
