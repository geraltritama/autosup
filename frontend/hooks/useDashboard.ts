"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";

export type AiInsight = {
  type: string;
  message: string;
  urgency: "high" | "medium" | "low";
  agent_name?: string;
  timestamp?: string;
  item_id?: string;
  full_result?: string;
};

type DistributorSummaryData = {
  role: "distributor";
  inventory: { total_items: number; low_stock_count: number; out_of_stock_count: number };
  orders: { active_orders: number; pending_orders: number; completed_this_month: number };
  suppliers: { partner_count: number; pending_requests: number };
  retailers: { partner_count: number; pending_requests: number };
  financials?: { revenue: number; spending: number; net_margin: number; monthly_revenue: number };
  pending_incoming?: { order_id: string; buyer_name: string; total: number; created_at: string }[];
  ai_insights: AiInsight[];
};

type SupplierSummaryData = {
  role: "supplier";
  products: { total_active: number; low_stock_count: number; out_of_stock_count: number };
  orders: { incoming_orders: number; processing: number; completed_this_month: number };
  partners: { distributor_count: number; pending_requests: number };
  demand_growth?: number;
  top_products?: { name: string; volume: number }[];
  recent_orders?: { order_id: string; buyer_name: string; status: string; total: number; created_at: string }[];
  demand_trend_chart?: { period: string; value: number }[];
  distributor_activity?: { event: string; timestamp: string }[];
  ai_insights: AiInsight[];
};

type RetailerSummaryData = {
  role: "retailer";
  inventory: { total_items: number; low_stock_count: number; out_of_stock_count: number };
  orders: {
    active_orders: number;
    pending_approval: number;
    in_transit: number;
    completed_this_month: number;
    order_accuracy_rate: number;
  };
  spending: {
    total_outstanding: number;
    monthly_spending: number;
    available_credit: number;
    upcoming_due_payments: number;
    payment_success_rate: number;
  };
  distributors: {
    active_partnered: number;
    pending_requests: number;
    average_reliability_score: number;
    avg_delivery_time: number;
  };
  open_orders_by_distributor?: {
    seller_id: string;
    seller_name: string;
    open_orders: number;
    in_transit: number;
    outstanding_amount: number;
  }[];
  credit_lines?: {
    distributor_id: string;
    distributor_name: string;
    status: string;
    credit_limit: number;
    utilized_amount: number;
    available_amount: number;
    next_due_amount: number;
  }[];
  forecast_accuracy_pct: number;
  ai_insights: AiInsight[];
};

export type DashboardSummary =
  | DistributorSummaryData
  | SupplierSummaryData
  | RetailerSummaryData;

async function fetchDashboardSummary(
  role: "distributor" | "supplier" | "retailer",
  userId: string,
): Promise<DashboardSummary> {
  const params = userId ? `?user_id=${userId}` : "";
  const { data } = await api.get<ApiResponse<Omit<DashboardSummary, "role">>>(`/dashboard/summary${params}`, {
    headers: { "x-user-role": role },
  });
  return { ...data.data, role } as DashboardSummary;
}

export function useDashboard() {
  const role = useAuthStore((s) => s.user?.role) ?? "distributor";
  const userId = useAuthStore((s) => s.user?.user_id) ?? "";

  return useQuery({
    queryKey: ["dashboard", "summary", role, userId],
    queryFn: () => fetchDashboardSummary(role, userId),
    staleTime: 60 * 1000,
  });
}
