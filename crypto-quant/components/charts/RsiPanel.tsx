"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDate } from "@/lib/format";

export function RsiPanel({
  data,
  oversold = 30,
  overbought = 70,
}: {
  data: { time: number; value: number }[];
  oversold?: number;
  overbought?: number;
}) {
  const chartData = data.filter((d) => Number.isFinite(d.value));
  return (
    <ResponsiveContainer width="100%" height={120}>
      <LineChart data={chartData} margin={{ left: 8, right: 8, top: 4, bottom: 0 }}>
        <CartesianGrid stroke="#1a212c" vertical={false} />
        <XAxis dataKey="time" tickFormatter={(v) => formatDate(v)} stroke="#8a93a3" fontSize={10} minTickGap={50} hide />
        <YAxis domain={[0, 100]} stroke="#8a93a3" fontSize={10} width={30} ticks={[0, 30, 50, 70, 100]} />
        <ReferenceLine y={overbought} stroke="#ea3943" strokeDasharray="3 3" />
        <ReferenceLine y={oversold} stroke="#16c784" strokeDasharray="3 3" />
        <Tooltip
          contentStyle={{ background: "#161d29", border: "1px solid #232b38", fontSize: 12 }}
          labelFormatter={(v) => formatDate(Number(v))}
          formatter={(v: number) => v.toFixed(1)}
        />
        <Line type="monotone" dataKey="value" name="RSI" stroke="#f2a900" strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
