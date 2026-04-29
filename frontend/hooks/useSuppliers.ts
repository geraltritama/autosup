"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { getMockSuppliers, getMockPartnershipRequests, mockSuppliers, mockPartnershipRequests } from "@/lib/mocks/suppliers";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

export type SupplierType = "partner" | "discover";

export type Supplier = {
  supplier_id: string;
  name: string;
  category: string;
  type: SupplierType;
  reputation_score: number;
  total_transactions: number;
  on_time_delivery_rate: number;
  wallet_address: string;
  is_active: boolean;
};

export type PartnershipRequest = {
  request_id: string;
  distributor: {
    id: string;
    name: string;
    business_name: string;
  };
  status: "pending" | "accepted" | "rejected";
  created_at: string;
};

export type SuppliersResponse = {
  suppliers: Supplier[];
  summary: {
    partner_count: number;
    discover_count: number;
    pending_requests: number;
  };
  pagination: { page: number; limit: number; total: number };
};

export type PartnershipRequestsResponse = {
  requests: PartnershipRequest[];
  pagination: { page: number; limit: number; total: number };
};

type SupplierFilters = {
  search?: string;
  type?: string;
  page?: number;
  limit?: number;
};

export function useSuppliers(filters: SupplierFilters = {}) {
  return useQuery({
    queryKey: ["suppliers", filters],
    queryFn: async (): Promise<SuppliersResponse> => {
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 400));
        return getMockSuppliers(filters);
      }
      const params = new URLSearchParams();
      if (filters.search) params.set("search", filters.search);
      if (filters.type) params.set("type", filters.type);
      if (filters.page) params.set("page", String(filters.page));
      if (filters.limit) params.set("limit", String(filters.limit));
      const { data } = await api.get<ApiResponse<SuppliersResponse>>(`/suppliers?${params.toString()}`);
      return data.data;
    },
    staleTime: 30 * 1000,
  });
}

export function usePartnershipRequests(status?: string) {
  return useQuery({
    queryKey: ["partnership-requests", status],
    queryFn: async (): Promise<PartnershipRequestsResponse> => {
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 350));
        return getMockPartnershipRequests(status);
      }
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      const { data } = await api.get<ApiResponse<PartnershipRequestsResponse>>(
        `/suppliers/partnership-requests?${params.toString()}`,
      );
      return data.data;
    },
    staleTime: 30 * 1000,
  });
}

export function useRequestPartnership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (supplier_id: string) => {
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 500));
        const supplier = mockSuppliers.find((s) => s.supplier_id === supplier_id);
        return {
          request_id: `req-uuid-${Date.now()}`,
          supplier_id,
          supplier_name: supplier?.name ?? "Supplier",
          status: "pending" as const,
          created_at: new Date().toISOString(),
        };
      }
      const { data } = await api.post<ApiResponse<{ request_id: string; supplier_id: string; supplier_name: string; status: string; created_at: string }>>(
        "/suppliers/partnership-request",
        { supplier_id },
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      qc.invalidateQueries({ queryKey: ["partnership-requests"] });
    },
  });
}

export function useRespondPartnership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ request_id, action }: { request_id: string; action: "accept" | "reject" }) => {
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 400));
        const req = mockPartnershipRequests.find((r) => r.request_id === request_id);
        if (req) req.status = action === "accept" ? "accepted" : "rejected";
        return { request_id, action };
      }
      const { data } = await api.put<ApiResponse<{ request_id: string; action: string }>>(
        `/suppliers/partnership-request/${request_id}`,
        { action },
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partnership-requests"] });
      qc.invalidateQueries({ queryKey: ["suppliers"] });
    },
  });
}
