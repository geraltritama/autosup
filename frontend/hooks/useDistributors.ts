"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";

export type Distributor = {
  distributor_id: string;
  name: string;
  business_name: string;
  region: string;
  partnership_status: "partner" | "pending" | "none";
  order_volume: number;
  payment_punctuality: number;
  avg_delivery_days: number;
  on_time_delivery_rate: number;
  reputation_score: number;
  total_transactions: number;
  is_active: boolean;
  address?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  joined_at?: string;
};

export type DistributorPartnershipRequest = {
  request_id: string;
  distributor: {
    id: string;
    name: string;
    business_name: string;
    region?: string;
    contact_person?: string;
    phone?: string;
    email?: string;
    reputation_score?: number;
  };
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  terms?: string;
  proposed_start_date?: string;
  proposed_end_date?: string;
};

export type DistributorsResponse = {
  distributors: Distributor[];
  summary: {
    partner_count: number;
    pending_count: number;
    total_order_volume: number;
    avg_punctuality: number;
    avg_delivery_days: number;
  };
  pagination: { page: number; limit: number; total: number };
};

export type DistributorRequestsResponse = {
  requests: DistributorPartnershipRequest[];
  pagination: { page: number; limit: number; total: number };
};

type DistributorFilters = {
  search?: string;
  status?: string;
  type?: string;
  page?: number;
  limit?: number;
};

export function useDistributors(filters: DistributorFilters = {}) {
  const userId = useAuthStore((s) => s.user?.user_id);
  return useQuery({
    queryKey: ["distributors", filters, userId],
    queryFn: async (): Promise<DistributorsResponse> => {
      const params = new URLSearchParams();
      if (filters.search) params.set("search", filters.search);
      if (filters.status) params.set("status", filters.status);
      if (filters.type) params.set("type", filters.type);
      if (filters.page) params.set("page", String(filters.page));
      if (filters.limit) params.set("limit", String(filters.limit));
      if (userId) params.set("user_id", userId);
      const { data } = await api.get<ApiResponse<DistributorsResponse>>(
        `/distributors?${params.toString()}`,
      );
      return data.data;
    },
    staleTime: 30 * 1000,
  });
}

type RawPartnershipRequest = {
  request_id: string;
  distributor_id: string;
  distributor_name: string;
  supplier_id?: string;
  city?: string;
  reliability_score?: number;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
};

export function useDistributorRequests(status?: string) {
  const userId = useAuthStore((s) => s.user?.user_id);
  return useQuery({
    queryKey: ["distributor-requests", status, userId],
    queryFn: async (): Promise<DistributorRequestsResponse> => {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (userId) params.set("user_id", userId);
      const { data } = await api.get<ApiResponse<{ requests: RawPartnershipRequest[]; pagination: DistributorRequestsResponse["pagination"] }>>(
        `/distributors/partnership-requests?${params.toString()}`,
      );
      return {
        requests: (data.data.requests ?? []).map((r) => ({
          request_id: r.request_id,
          status: r.status,
          created_at: r.created_at,
          distributor: {
            id: r.distributor_id,
            name: r.distributor_name,
            business_name: r.distributor_name,
            region: r.city,
            reputation_score: r.reliability_score,
          },
        })),
        pagination: data.data.pagination,
      };
    },
    staleTime: 30 * 1000,
  });
}

export function useRespondDistributorRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      request_id,
      action,
    }: {
      request_id: string;
      action: "accept" | "reject";
    }) => {
      const { data } = await api.put<
        ApiResponse<{ request_id: string; action: string }>
      >(`/distributors/partnership-request/${request_id}`, { action });
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["distributors"], exact: false });
      qc.invalidateQueries({ queryKey: ["distributor-requests"], exact: false });
    },
  });
}

export type InventoryStatus = "in_stock" | "low_stock" | "out_of_stock";

export type DistributorStockItem = {
  item_id: string;
  name: string;
  category: string;
  stock: number;
  min_stock: number;
  unit: string;
  status: InventoryStatus;
  estimated_restock_days: number | null;
  last_updated: string;
};

export type DistributorStockResponse = {
  distributor: { distributor_id: string; name: string; is_partner: boolean };
  products: DistributorStockItem[];
  pagination: { page: number; limit: number; total: number };
};

export function useDistributorStock(distributorId: string | null) {
  return useQuery({
    queryKey: ["distributor-stock", distributorId],
    enabled: !!distributorId,
    queryFn: async (): Promise<DistributorStockResponse> => {
      const { data } = await api.get<ApiResponse<DistributorStockResponse>>(
        `/distributors/${distributorId}/stock`,
      );
      return data.data;
    },
    staleTime: 60 * 1000,
  });
}

export function useDeleteDistributorPartnership() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.user_id);
  return useMutation({
    mutationFn: async (distributorId: string) => {
      const { data } = await api.delete<ApiResponse<{ terminated: number }>>(
        `/partnerships/between/${distributorId}?user_id=${userId ?? ""}`,
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["distributors"] });
      qc.invalidateQueries({ queryKey: ["distributor-requests"] });
    },
  });
}

export function useRequestDistributorPartnership() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.user_id);
  return useMutation({
    mutationFn: async (distributor_id: string) => {
      const { data } = await api.post<ApiResponse<{ request_id: string; distributor_id: string; distributor_name: string; status: string; created_at: string }>>(
        "/distributors/partnership-request",
        { distributor_id, requester_id: userId ?? "" },
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["distributors"] });
      qc.invalidateQueries({ queryKey: ["distributor-requests"] });
    },
  });
}
