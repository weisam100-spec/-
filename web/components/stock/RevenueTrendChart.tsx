import type { MonthlyRevenue } from "@/lib/types/stock";

export function RevenueTrendChart({ data }: { data: MonthlyRevenue[] }) {
  if (data.length < 2) {
    return <p className="text-sm text-muted-foreground">尚無足夠月營收資料繪製趨勢。</p>;
  }

  const values = data.map((d) => d.revenue);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 600;
  const h = 120;
  const pad = 6;
  const stepX = (w - pad * 2) / (data.length - 1);

  const points = data.map((d, i) => {
    const x = pad + stepX * i;
    const y = pad + (h - pad * 2) * (1 - (d.revenue - min) / range);
    return [x, y] as const;
  });
  const path = points.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
  const last = points[points.length - 1];
  const up = data[data.length - 1].revenue >= data[0].revenue;

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-28 w-full" preserveAspectRatio="none">
        <path
          d={path}
          fill="none"
          stroke={up ? "var(--color-up)" : "var(--color-down)"}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={last[0]} cy={last[1]} r={4} fill={up ? "var(--color-up)" : "var(--color-down)"} />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{data[0].month}</span>
        <span>{data[data.length - 1].month}</span>
      </div>
    </div>
  );
}
