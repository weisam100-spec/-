"use client";

import { Bar, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDate } from "@/lib/format";

export function MacdPanel({
  data,
}: {
  data: { time: number; macd: number; signal: number; histogram: number }[];
}) {
  const chartData = data.filter((d) => Number.isFinite(d.macd));
  return (
    <ResponsiveContainer width="100%" height={130}>
      <ComposedChart data={chartData} margin={{ left: 8, right: 8, top: 4, bottom: 0 }}>
        <CartesianGrid stroke="#1a212c" vertical={false} />
        <XAxis dataKey="time" tickFormatter={(v) => formatDate(v)} stroke="#8a93a3" fontSize={10} minTickGap={50} />
        <YAxis stroke="#8a93a3" fontSize={10} width={40} />
        <Tooltip
          contentStyle={{ background: "#161d29", border: "1px solid #232b38", fontSize: 12 }}
          labelFormatter={(v) => formatDate(Number(v))}
        />
        <Bar dataKey="histogram" name="柱狀圖">
          {chartData.map((d, i) => (
            <Cell key={i} fill={d.histogram >= 0 ? "#16c784" : "#ea3943"} />
          ))}
        </Bar>
        <Line type="monotone" dataKey="macd" name="MACD" stroke="#3b82f6" strokeWidth={1.5} dot={false} />
        <Line type="monotone" dataKey="signal" name="訊號線" stroke="#f2a900" strokeWidth={1.5} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
