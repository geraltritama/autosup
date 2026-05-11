"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RetailerSegment = "premium" | "regular" | "new";
export type RetailerStatus = "active" | "inactive" | "high_risk";
export type RiskLevel = "low" | "medium" | "high";

export type Retailer = {
  retailer_id: string;
  name: string;
  contact_person: string;
  phone: string;
  city: string;
  segment: RetailerSegment;
  status: RetailerStatus;
  monthly_order_volume: number;
  total_purchase_amount: number;
  last_order_at: string;
  partnership_status?: "partner" | "pending" | "none";
};

export type RetailerDetail = Retailer & {
  email: string;
  address: string;
  purchase_history: {
    order_id: string;
    order_number: string;
    total_amount: number;
    status: string;
    created_at: string;
  }[];
  demand_intelligence: {
    top_products: { item_name: string; qty_last_30d: number; unit: string }[];
    order_frequency_per_month: number;
    forecast_growth_pct: number;
  };
  credit_summary: {
    has_active_credit: boolean;
    credit_limit: number;
    outstanding_balance: number;
    risk_level: RiskLevel;
  } | null;
};

export type RetailersResponse = {
  retailers: Retailer[];
  summary: {
    total: number;
    active: number;
    premium_count: number;
  };
  pagination: { page: number; limit: number; total: number };
};

export type AddRetailerPayload = {
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  segment: RetailerSegment;
};

type RetailerFilters = {
  segment?: RetailerSegment;
  status?: RetailerStatus;
  search?: string;
  page?: number;
  limit?: number;
  type?: "partner" | "all";
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useRetailers(filters: RetailerFilters = {}) {
  const userId = useAuthStore((s) => s.user?.user_id);
  return useQuery({
    queryKey: ["retailers", filters, userId],
    queryFn: async (): Promise<RetailersResponse> => {
      const params = new URLSearchParams();
      if (filters.segment) params.set("segment", filters.segment);
      if (filters.status) params.set("status", filters.status);
      if (filters.search) params.set("search", filters.search);
      if (filters.type) params.set("type", filters.type);
      if (filters.page) params.set("page", String(filters.page));
      if (filters.limit) params.set("limit", String(filters.limit));
      if (userId) params.set("user_id", userId);
      const { data } = await api.get<ApiResponse<RetailersResponse>>(
        `/retailers?${params.toString()}`,
      );
      return data.data;
    },
    staleTime: 30 * 1000,
  });
}

export function useRetailerDetail(retailerId: string | null) {
  return useQuery({
    queryKey: ["retailers", retailerId],
    queryFn: async (): Promise<RetailerDetail> => {
      const { data } = await api.get<ApiResponse<RetailerDetail>>(`/retailers/${retailerId}`);
      return data.data;
    },
    enabled: !!retailerId,
    staleTime: 30 * 1000,
  });
}

export function useAddRetailer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: AddRetailerPayload): Promise<Retailer> => {
      const userId = useAuthStore.getState().user?.user_id;
      const { data } = await api.post<ApiResponse<Retailer>>("/retailers", {
        ...payload,
        distributor_id: userId,
      });
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["retailers"] }),
  });
}

export function useUpdateRetailer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      retailerId,
      body,
    }: {
      retailerId: string;
      body: Partial<Pick<Retailer, "phone" | "segment" | "status">>;
    }): Promise<Retailer> => {
      const { data } = await api.put<ApiResponse<Retailer>>(`/retailers/${retailerId}`, body);
      return data.data;
    },
    onSuccess: (_data, { retailerId }) => {
      qc.invalidateQueries({ queryKey: ["retailers"] });
      qc.invalidateQueries({ queryKey: ["retailers", retailerId] });
    },
  });
}

export function useDeleteRetailerPartnership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (retailerId: string) => {
      const uid = useAuthStore.getState().user?.user_id;
      if (!uid) throw new Error("Not authenticated");
      const { data } = await api.delete<ApiResponse<{ terminated: number }>>(
        `/partnerships/between/${retailerId}?user_id=${uid}`,
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["retailers"] });
      qc.invalidateQueries({ queryKey: ["partnerships"] });
    },
    onError: () => {
      qc.invalidateQueries({ queryKey: ["retailers"] });
    },
  });
}
