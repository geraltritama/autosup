"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ProductDemand } from "@/hooks/useDemand";

type Props = {
  rising: ProductDemand[];
  declining: ProductDemand[];
};

export function ProductComparisonChart({ rising, declining }: Props) {
  const combinedData = [
    ...rising.slice(0, 4).map((item) => ({
      name: item.name.length > 20 ? item.name.substring(0, 20) + "..." : item.name,
      demand: item.current_demand,
      growth: item.growth_pct,
      type: "rising" as const,
      fullName: item.name,
    })),
    ...declining.slice(0, 4).map((item) => ({
      name: item.name.length > 20 ? item.name.substring(0, 20) + "..." : item.name,
      demand: item.current_demand,
      growth: item.growth_pct,
      type: "declining" as const,
      fullName: item.name,
    })),
  ];

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={combinedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: "#64748B" }}
            axisLine={{ stroke: "#E2E8F0" }}
            tickLine={false}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "#64748B" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #E2E8F0",
              borderRadius: "12px",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
            }}
            labelStyle={{ fontWeight: 600, color: "#0F172A" }}
            formatter={(value) => {
              const entry = combinedData.find((d) => d.demand === value);
              return [
                `${new Intl.NumberFormat("id-ID").format(Number(value))} (${entry?.growth && entry.growth > 0 ? "+" : ""}${entry?.growth}%)`,
                "Demand",
              ];
            }}
          />
          <Bar dataKey="demand" radius={[4, 4, 0, 0]}>
            {combinedData.map((entry, index) => (
              <Bar key={`bar-${index}`} fill={entry.type === "rising" ? "#22C55E" : "#EF4444"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}