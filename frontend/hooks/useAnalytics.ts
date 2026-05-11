"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";

// --- Distributor / Retailer Analytics (shared shape) ---

export type AnalyticsSummary = {
  revenue_growth: number;
  inventory_turnover: number;
  partner_performance: number;
  order_fulfillment_rate: number;
  forecast_accuracy: number;
};

export type TrendDataPoint = {
  label: string;
  revenue: number;
  spending: number;
};

export type AnalyticsResponse = {
  summary: AnalyticsSummary;
  trends: TrendDataPoint[];
  top_products: { name: string; sales: number }[];
};

export function useRetailerAnalytics(enabled = true) {
  const userId = useAuthStore((s) => s.user?.user_id);
  return useQuery({
    queryKey: ["analytics", "retailer", userId],
    enabled: enabled && !!userId,
    queryFn: async (): Promise<AnalyticsResponse> => {
      const params = userId ? `?user_id=${userId}` : "";
      const { data } = await api.get<ApiResponse<AnalyticsResponse>>(`/analytics/retailer/overview${params}`);
      return data.data;
    },
    staleTime: 60 * 1000,
  });
}

export function useDistributorAnalytics(enabled = true) {
  const userId = useAuthStore((s) => s.user?.user_id);
  return useQuery({
    queryKey: ["analytics", "distributor", userId],
    enabled: enabled && !!userId,
    queryFn: async (): Promise<AnalyticsResponse> => {
      const params = userId ? `?user_id=${userId}` : "";
      const { data } = await api.get<ApiResponse<AnalyticsResponse>>(`/analytics/distributor/overview${params}`);
      return data.data;
    },
    staleTime: 60 * 1000,
  });
}

// --- Supplier Analytics (distinct API shape) ---

export type SupplierAnalyticsSummary = {
  total_revenue: number;
  demand_growth_pct: number;
  fulfillment_rate: number;
  active_distributor_contribution_pct: number;
};

export type SupplierTrendData = {
  label: string;
  value: number;
};

export type SupplierAnalyticsTrends = {
  revenue: SupplierTrendData[];
  demand: SupplierTrendData[];
  orders: SupplierTrendData[];
  fulfillment: SupplierTrendData[];
};

export type DistributorPerformance = {
  distributor_id: string;
  name: string;
  order_volume: number;
  revenue_contribution: number;
  fulfillment_success_rate: number;
  reliability_score: number;
};

export type SupplierAnalyticsResponse = {
  summary: SupplierAnalyticsSummary;
  trends: SupplierAnalyticsTrends;
  distributor_performance: DistributorPerformance[];
};

export function useSupplierAnalytics(enabled = true) {
  const userId = useAuthStore((s) => s.user?.user_id);
  return useQuery({
    queryKey: ["analytics", "supplier", userId],
    enabled: enabled && !!userId,
    queryFn: async (): Promise<SupplierAnalyticsResponse> => {
      const params = userId ? `?user_id=${userId}` : "";
      const { data } = await api.get<ApiResponse<SupplierAnalyticsResponse>>(`/analytics/supplier/overview${params}`);
      return data.data;
    },
    staleTime: 60 * 1000,
  });
}

// --- Regional Analytics ---

export type RegionalDemandPoint = {
  region: string;
  demand: number;
  growth_pct: number;
};

export type RegionalAnalyticsResponse = {
  regional_demand: RegionalDemandPoint[];
};

export function useDistributorRegional(enabled = true) {
  const userId = useAuthStore((s) => s.user?.user_id);
  return useQuery({
    queryKey: ["analytics", "distributor", "regional", userId],
    enabled: enabled && !!userId,
    queryFn: async (): Promise<RegionalAnalyticsResponse> => {
      const params = userId ? `?user_id=${userId}` : "";
      const { data } = await api.get<ApiResponse<RegionalAnalyticsResponse>>(`/analytics/distributor/regional${params}`);
      return data.data;
    },
    staleTime: 60 * 1000,
  });
}

export function useSupplierRegional(enabled = true) {
  const userId = useAuthStore((s) => s.user?.user_id);
  return useQuery({
    queryKey: ["analytics", "supplier", "regional", userId],
    enabled: enabled && !!userId,
    queryFn: async (): Promise<RegionalAnalyticsResponse> => {
      const params = userId ? `?user_id=${userId}` : "";
      const { data } = await api.get<ApiResponse<RegionalAnalyticsResponse>>(`/analytics/supplier/regional${params}`);
      return data.data;
    },
    staleTime: 60 * 1000,
  });
}

// --- Product Insights ---

export type ProductInsightItem = {
  item_id: string;
  name: string;
  volume: number;
  trend: "up" | "down" | "stable";
};

export type StockRiskItem = {
  item_id: string;
  name: string;
  stock: number;
  min_stock: number;
};

export type ProductInsightsResponse = {
  top_selling: ProductInsightItem[];
  declining: ProductInsightItem[];
  stock_risk: StockRiskItem[];
};

export function useProductInsights(enabled = true) {
  const userId = useAuthStore((s) => s.user?.user_id);
  return useQuery({
    queryKey: ["analytics", "products", "insights", userId],
    enabled: enabled && !!userId,
    queryFn: async (): Promise<ProductInsightsResponse> => {
      const params = userId ? `?user_id=${userId}` : "";
      const { data } = await api.get<ApiResponse<{
        top_selling: { name: string; units: number; growth_pct: number }[];
        declining: { name: string; units: number; decline_pct: number }[];
        stock_risk: { name: string; stock: number; min_stock: number }[];
      }>>(`/analytics/products/insights${params}`);
      const raw = data.data;
      return {
        top_selling: (raw.top_selling ?? []).map((p, i) => ({
          item_id: `top-${i}`,
          name: p.name,
          volume: p.units,
          trend: "up" as const,
        })),
        declining: (raw.declining ?? []).map((p, i) => ({
          item_id: `dec-${i}`,
          name: p.name,
          volume: p.units,
          trend: "down" as const,
        })),
        stock_risk: (raw.stock_risk ?? []).map((p, i) => ({
          item_id: `risk-${i}`,
          name: p.name,
          stock: p.stock,
          min_stock: p.min_stock,
        })),
      };
    },
    staleTime: 60 * 1000,
  });
}
