"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDate } from "@/lib/format";
import { computeDrawdownSeries } from "@/lib/client/deriveCharts";
import type { EquityPoint } from "@/lib/backtest/types";

export function DrawdownChart({ data }: { data: EquityPoint[] }) {
  const series = computeDrawdownSeries(data);
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={series} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="ddFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ea3943" stopOpacity={0} />
            <stop offset="100%" stopColor="#ea3943" stopOpacity={0.35} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#1a212c" vertical={false} />
        <XAxis dataKey="time" tickFormatter={(v) => formatDate(v)} stroke="#8a93a3" fontSize={11} minTickGap={40} />
        <YAxis stroke="#8a93a3" fontSize={11} tickFormatter={(v) => `${v.toFixed(0)}%`} width={50} />
        <Tooltip
          contentStyle={{ background: "#161d29", border: "1px solid #232b38", fontSize: 12 }}
          labelFormatter={(v) => formatDate(Number(v))}
          formatter={(v: number) => `${v.toFixed(2)}%`}
        />
        <Area type="monotone" dataKey="drawdownPct" name="回撤" stroke="#ea3943" fill="url(#ddFill)" strokeWidth={1.5} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
