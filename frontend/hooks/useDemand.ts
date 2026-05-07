"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";

export type DemandInsight = {
  type: "production_recommendation" | "trend_alert" | "inventory_warning" | "demand_forecast";
  message: string;
  urgency: "high" | "medium" | "low";
};

export type ProductDemand = {
  id: string;
  name: string;
  current_demand: number;
  growth_pct: number;
  trend: "rising" | "stable" | "declining";
  category?: string;
};

export type DemandTrendPoint = {
  period: string;
  total_volume: number;
};

export type DistributorProductPerformance = {
  distributor_id: string;
  distributor_name: string;
  products: {
    product_id: string;
    product_name: string;
    quantity: number;
    revenue: number;
    last_order_date: string;
  }[];
};

export type DemandResponse = {
  insights: DemandInsight[];
  top_rising: ProductDemand[];
  declining: ProductDemand[];
  trends: DemandTrendPoint[];
  top_selling: ProductDemand[];
  product_performance_by_distributor: DistributorProductPerformance[];
};

export function useDemandIntelligence(period: "weekly" | "monthly" = "monthly") {
  const userId = useAuthStore((s) => s.user?.user_id);
  return useQuery({
    queryKey: ["demand-intelligence", period, userId],
    queryFn: async (): Promise<DemandResponse> => {
      const params = new URLSearchParams({ period });
      if (userId) params.set("user_id", userId);
      const { data } = await api.get<ApiResponse<DemandResponse>>(`/analytics/supplier/demand?${params.toString()}`);
      return data.data;
    },
    staleTime: 60 * 1000,
  });
}
