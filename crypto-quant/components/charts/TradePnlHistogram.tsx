"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { computePnlBuckets } from "@/lib/client/deriveCharts";
import type { TradeRecord } from "@/lib/backtest/types";

export function TradePnlHistogram({ trades }: { trades: TradeRecord[] }) {
  const buckets = computePnlBuckets(trades);
  if (buckets.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={buckets} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid stroke="#1a212c" vertical={false} />
        <XAxis dataKey="label" stroke="#8a93a3" fontSize={10} interval={0} angle={-35} textAnchor="end" height={60} />
        <YAxis stroke="#8a93a3" fontSize={11} allowDecimals={false} width={30} />
        <Tooltip contentStyle={{ background: "#161d29", border: "1px solid #232b38", fontSize: 12 }} />
        <Bar dataKey="count" name="交易筆數" radius={[3, 3, 0, 0]}>
          {buckets.map((b, i) => (
            <Cell key={i} fill={b.isProfit ? "#16c784" : "#ea3943"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
