"use client";

import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";

export function Sparkline({ data, color }: { data: { time: number; close: number }[]; color: string }) {
  if (data.length < 2) {
    return <div className="flex h-16 items-center justify-center text-xs text-[var(--color-text-muted)]">資料不足</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={64}>
      <LineChart data={data} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
        <YAxis hide domain={["dataMin", "dataMax"]} />
        <Line type="monotone" dataKey="close" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
