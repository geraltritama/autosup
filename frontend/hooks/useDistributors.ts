"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import {
  getMockDistributors,
  getMockDistributorRequests,
  mockDistributorRequests,
  type Distributor,
  type DistributorPartnershipRequest,
} from "@/lib/mocks/distributors";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

export type DistributorsResponse = {
  distributors: Distributor[];
  summary: {
    partner_count: number;
    pending_count: number;
    total_order_volume: number;
    avg_punctuality: number;
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
  page?: number;
  limit?: number;
};

export function useDistributors(filters: DistributorFilters = {}) {
  return useQuery({
    queryKey: ["distributors", filters],
    queryFn: async (): Promise<DistributorsResponse> => {
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 400));
        return getMockDistributors(filters);
      }
      const params = new URLSearchParams();
      if (filters.search) params.set("search", filters.search);
      if (filters.status) params.set("status", filters.status);
      if (filters.page) params.set("page", String(filters.page));
      if (filters.limit) params.set("limit", String(filters.limit));
      const { data } = await api.get<ApiResponse<DistributorsResponse>>(
        `/suppliers?${params.toString()}`,
      );
      return data.data;
    },
    staleTime: 30 * 1000,
  });
}

export function useDistributorRequests(status?: string) {
  return useQuery({
    queryKey: ["distributor-requests", status],
    queryFn: async (): Promise<DistributorRequestsResponse> => {
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 350));
        return getMockDistributorRequests(status);
      }
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      const { data } = await api.get<ApiResponse<DistributorRequestsResponse>>(
        `/suppliers/partnership-requests?${params.toString()}`,
      );
      return data.data;
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
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 400));
        const req = mockDistributorRequests.find((r) => r.request_id === request_id);
        if (req) req.status = action === "accept" ? "accepted" : "rejected";
        return { request_id, action };
      }
      const { data } = await api.put<
        ApiResponse<{ request_id: string; action: string }>
      >(`/suppliers/partnership-request/${request_id}`, { action });
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["distributors"] });
      qc.invalidateQueries({ queryKey: ["distributor-requests"] });
    },
  });
}

export type { Distributor, DistributorPartnershipRequest };
