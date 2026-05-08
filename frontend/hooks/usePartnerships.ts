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
  nft_issued: number;
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

export type EscrowBlockchainEvent = {
  event: string;
  tx: string;
  timestamp: string;
  explorer_url?: string;
};

export type EscrowBlockchainDetails = {
  order_id: string;
  order_number: string;
  escrow_status: "held" | "released" | "refunded";
  order_status: string;
  total_amount: number;
  chain: string;
  program: string;
  creation_tx: string;
  explorer_url: string;
  events: EscrowBlockchainEvent[];
};

export function useBlockchainEscrow(orderId: string | null) {
  return useQuery({
    queryKey: ["blockchain", "escrow", orderId],
    enabled: !!orderId,
    queryFn: async (): Promise<EscrowBlockchainDetails> => {
      const { data } = await api.get<ApiResponse<EscrowBlockchainDetails>>(
        `/blockchain/escrow/${orderId}`,
      );
      return data.data;
    },
    staleTime: 30 * 1000,
  });
}

export function usePartnershipsSummary() {
  const role = useAuthStore((s) => s.user?.role);
  const userId = useAuthStore((s) => s.user?.user_id);

  return useQuery({
    queryKey: ["partnerships", "summary", role, userId],
    queryFn: async (): Promise<PartnershipsResponse> => {
      const params = userId ? `?user_id=${userId}` : "";
      const { data } = await api.get<ApiResponse<PartnershipsResponse>>(`/partnerships/summary${params}`);
      return data.data;
    },
    staleTime: 60 * 1000,
  });
}
