"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";

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
  return useQuery({
    queryKey: ["analytics", "retailer"],
    enabled,
    queryFn: async (): Promise<AnalyticsResponse> => {
      const { data } = await api.get<ApiResponse<AnalyticsResponse>>("/analytics/retailer/overview");
      return data.data;
    },
    staleTime: 60 * 1000,
  });
}

export function useDistributorAnalytics(enabled = true) {
  return useQuery({
    queryKey: ["analytics", "distributor"],
    enabled,
    queryFn: async (): Promise<AnalyticsResponse> => {
      const { data } = await api.get<ApiResponse<AnalyticsResponse>>("/analytics/distributor/overview");
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

type RawSupplierAnalytics = {
  summary: {
    total_revenue: number;
    total_orders: number;
    completed_orders: number;
    growth_pct: number;
  };
  trends: { period: string; revenue: number; orders: number }[];
  distributor_performance: {
    distributor_id: string;
    distributor_name: string;
    orders: number;
    revenue: number;
    reliability: number;
  }[];
};

function transformSupplierAnalytics(raw: RawSupplierAnalytics): SupplierAnalyticsResponse {
  const trendPoints = (raw.trends ?? []).map((t) => ({ label: t.period, value: t.revenue }));
  const orderPoints = (raw.trends ?? []).map((t) => ({ label: t.period, value: t.orders }));
  const totalOrders = raw.summary?.total_orders ?? 0;
  const completedOrders = raw.summary?.completed_orders ?? 0;
  const fulfillmentRate = totalOrders > 0 ? completedOrders / totalOrders : 0;
  return {
    summary: {
      total_revenue: raw.summary?.total_revenue ?? 0,
      demand_growth_pct: raw.summary?.growth_pct ?? 0,
      fulfillment_rate: fulfillmentRate,
      active_distributor_contribution_pct: 0,
    },
    trends: {
      revenue: trendPoints,
      demand: trendPoints,
      orders: orderPoints,
      fulfillment: orderPoints,
    },
    distributor_performance: (raw.distributor_performance ?? []).map((d) => ({
      distributor_id: d.distributor_id,
      name: d.distributor_name,
      order_volume: d.orders,
      revenue_contribution: d.revenue,
      fulfillment_success_rate: 0,
      reliability_score: d.reliability,
    })),
  };
}

export function useSupplierAnalytics(enabled = true) {
  return useQuery({
    queryKey: ["analytics", "supplier"],
    enabled,
    queryFn: async (): Promise<SupplierAnalyticsResponse> => {
      const { data } = await api.get<ApiResponse<RawSupplierAnalytics>>("/analytics/supplier/overview");
      return transformSupplierAnalytics(data.data);
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
  return useQuery({
    queryKey: ["analytics", "distributor", "regional"],
    enabled,
    queryFn: async (): Promise<RegionalAnalyticsResponse> => {
      const { data } = await api.get<ApiResponse<RegionalAnalyticsResponse>>("/analytics/distributor/regional");
      return data.data;
    },
    staleTime: 60 * 1000,
  });
}

export function useSupplierRegional(enabled = true) {
  return useQuery({
    queryKey: ["analytics", "supplier", "regional"],
    enabled,
    queryFn: async (): Promise<RegionalAnalyticsResponse> => {
      const { data } = await api.get<ApiResponse<RegionalAnalyticsResponse>>("/analytics/supplier/regional");
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
  return useQuery({
    queryKey: ["analytics", "products", "insights"],
    enabled,
    queryFn: async (): Promise<ProductInsightsResponse> => {
      const { data } = await api.get<ApiResponse<{
        top_selling: { name: string; units: number; growth_pct: number }[];
        declining: { name: string; units: number; decline_pct: number }[];
        stock_risk: { name: string; stock: number; min_stock: number }[];
      }>>("/analytics/products/insights");
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
