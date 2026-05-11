"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DemandTrendPoint } from "@/hooks/useDemand";

type Props = {
  data: DemandTrendPoint[];
  period: "weekly" | "monthly";
};

export function TrendChart({ data, period }: Props) {
  const formattedData = data.map((item) => ({
    ...item,
    volume: item.total_volume,
  }));

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
          <XAxis
            dataKey="period"
            tick={{ fontSize: 12, fill: "#64748B" }}
            axisLine={{ stroke: "#E2E8F0" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "#64748B" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #E2E8F0",
              borderRadius: "12px",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
            }}
            labelStyle={{ fontWeight: 600, color: "#0F172A" }}
            formatter={(value) => [
              new Intl.NumberFormat("en-US").format(Number(value)),
              "Unit",
            ]}
          />
          <Area
            type="monotone"
            dataKey="volume"
            stroke="#2563EB"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorVolume)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}