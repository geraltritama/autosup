"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";

export type PartnershipSummary = {
  active_partnerships: number;
  pending_agreements: number;
  contract_renewal_rate: number;
  trust_score: number;
  network_growth: number;
};

export type PartnershipInsight = {
  type: string;
  message: string;
  urgency: "high" | "medium" | "low";
  supplier_id?: string;
  distributor_id?: string;
  retailer_id?: string;
};

export type PartnershipsResponse = {
  summary: PartnershipSummary;
  insights: PartnershipInsight[];
};

export type SupplierPartnershipNFT = {
  distributor_id: string;
  supplier_id: string;
  mint_address: string;
  explorer_url: string;
  token_name: string;
  issued_at: string;
};

export type DistributorPartnershipNFT = {
  retailer_id: string;
  distributor_id: string;
  mint_address: string;
  explorer_url: string;
  token_name: string;
  issued_at: string;
};

export type PartnershipNFT = SupplierPartnershipNFT | DistributorPartnershipNFT;

export function usePartnershipNFT(supplierId: string | null) {
  const userId = useAuthStore((s) => s.user?.user_id ?? "me");
  return useQuery({
    queryKey: ["partnership-nft", "supplier", supplierId],
    enabled: !!supplierId,
    queryFn: async (): Promise<SupplierPartnershipNFT | null> => {
      const { data } = await api.get<ApiResponse<SupplierPartnershipNFT>>(
        `/blockchain/partnership-nft/${userId}/${supplierId}`,
      );
      return data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useDistributorPartnershipNFT(distributorId: string | null) {
  const userId = useAuthStore((s) => s.user?.user_id ?? "me");
  return useQuery({
    queryKey: ["partnership-nft", "distributor", distributorId],
    enabled: !!distributorId,
    queryFn: async (): Promise<DistributorPartnershipNFT | null> => {
      const { data } = await api.get<ApiResponse<DistributorPartnershipNFT>>(
        `/blockchain/partnership-nft/retailer/${userId}/${distributorId}`,
      );
      return data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useRetailerPartnershipNFT(retailerId: string | null) {
  const userId = useAuthStore((s) => s.user?.user_id ?? "me");
  return useQuery({
    queryKey: ["partnership-nft", "retailer", retailerId],
    enabled: !!retailerId,
    queryFn: async (): Promise<DistributorPartnershipNFT | null> => {
      const { data } = await api.get<ApiResponse<DistributorPartnershipNFT>>(
        `/blockchain/partnership-nft/distributor/${userId}/${retailerId}`,
      );
      return data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function usePartnershipsSummary() {
  const role = useAuthStore((s) => s.user?.role);

  return useQuery({
    queryKey: ["partnerships", "summary", role],
    queryFn: async (): Promise<PartnershipsResponse> => {
      const { data } = await api.get<ApiResponse<PartnershipsResponse>>("/partnerships/summary");
      return data.data;
    },
    staleTime: 60 * 1000,
  });
}
