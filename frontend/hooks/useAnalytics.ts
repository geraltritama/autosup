"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

export type AnalyticsSummary = {
  revenue_growth: number;
  inventory_turnover: number;
  supplier_performance: number;
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
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 600));
        return {
          summary: {
            revenue_growth: 14.2,
            inventory_turnover: 5.8,
            supplier_performance: 92,
            order_fulfillment_rate: 98,
            forecast_accuracy: 86,
          },
          trends: [
            { label: "Jan", revenue: 12000000, spending: 8000000 },
            { label: "Feb", revenue: 15000000, spending: 9500000 },
            { label: "Mar", revenue: 14500000, spending: 9000000 },
            { label: "Apr", revenue: 18000000, spending: 11000000 },
            { label: "May", revenue: 21000000, spending: 13000000 },
            { label: "Jun", revenue: 24500000, spending: 14500000 },
          ],
          top_products: [
            { name: "Kopi Arabika 1kg", sales: 120 },
            { name: "Susu UHT 1L", sales: 85 },
            { name: "Gula Aren Cair", sales: 64 },
          ],
        };
      }
      const { data } = await api.get<ApiResponse<AnalyticsResponse>>("/analytics/retailer/overview");
      return data.data;
    },
    staleTime: 60 * 1000,
  });
}

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
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 400));
        return {
          regional_demand: [
            { region: "Jakarta", demand: 45000, growth_pct: 12.3 },
            { region: "Bandung", demand: 28000, growth_pct: 8.7 },
            { region: "Surabaya", demand: 22000, growth_pct: 15.1 },
            { region: "Medan", demand: 15000, growth_pct: 5.4 },
            { region: "Makassar", demand: 9000, growth_pct: 21.2 },
          ],
        };
      }
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
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 400));
        return {
          regional_demand: [
            { region: "Jakarta", demand: 120000, growth_pct: 9.8 },
            { region: "Jawa Barat", demand: 85000, growth_pct: 11.2 },
            { region: "Jawa Timur", demand: 72000, growth_pct: 7.5 },
            { region: "Sumatra Utara", demand: 40000, growth_pct: 18.4 },
            { region: "Sulawesi Selatan", demand: 28000, growth_pct: 23.1 },
          ],
        };
      }
      const { data } = await api.get<ApiResponse<RegionalAnalyticsResponse>>("/analytics/supplier/regional");
      return data.data;
    },
    staleTime: 60 * 1000,
  });
}

export function useSupplierAnalytics(enabled = true) {
  return useQuery({
    queryKey: ["analytics", "supplier"],
    enabled,
    queryFn: async (): Promise<AnalyticsResponse> => {
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 600));
        return {
          summary: {
            revenue_growth: 18.5,
            inventory_turnover: 4.2,
            supplier_performance: 95,
            order_fulfillment_rate: 97,
            forecast_accuracy: 91,
          },
          trends: [
            { label: "Jan", revenue: 25000000, spending: 15000000 },
            { label: "Feb", revenue: 28000000, spending: 16500000 },
            { label: "Mar", revenue: 26000000, spending: 15800000 },
            { label: "Apr", revenue: 32000000, spending: 19000000 },
            { label: "May", revenue: 35000000, spending: 20000000 },
            { label: "Jun", revenue: 38000000, spending: 22000000 },
          ],
          top_products: [
            { name: "Minyak Goreng 2L", sales: 245 },
            { name: "Tepung Terigu 1kg", sales: 180 },
            { name: "Gula Pasir 1kg", sales: 156 },
          ],
        };
      }
      const { data } = await api.get<ApiResponse<AnalyticsResponse>>("/analytics/supplier/overview");
      return data.data;
    },
    staleTime: 60 * 1000,
  });
}
