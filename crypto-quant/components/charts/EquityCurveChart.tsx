"use client";

import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDate } from "@/lib/format";
import type { EquityPoint } from "@/lib/backtest/types";

export function EquityCurveChart({ data }: { data: EquityPoint[] }) {
  const chartData = data.map((p) => ({ time: p.time, 策略資產: p.equity, 買進持有: p.buyHoldEquity }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={chartData} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#1a212c" vertical={false} />
        <XAxis
          dataKey="time"
          tickFormatter={(v) => formatDate(v)}
          stroke="#8a93a3"
          fontSize={11}
          minTickGap={40}
        />
        <YAxis stroke="#8a93a3" fontSize={11} tickFormatter={(v) => v.toLocaleString()} width={70} />
        <Tooltip
          contentStyle={{ background: "#161d29", border: "1px solid #232b38", fontSize: 12 }}
          labelFormatter={(v) => formatDate(Number(v))}
          formatter={(v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area type="monotone" dataKey="策略資產" stroke="#3b82f6" fill="url(#equityFill)" strokeWidth={2} dot={false} />
        <Area type="monotone" dataKey="買進持有" stroke="#8a93a3" fill="none" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
