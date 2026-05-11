"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  const role = useAuthStore((s) => s.user?.role);
  return useQuery({
    queryKey: ["partnership-nft", "distributor", distributorId],
    enabled: !!distributorId,
    queryFn: async (): Promise<DistributorPartnershipNFT | null> => {
      // Supplier viewing distributor partner vs retailer viewing distributor partner
      const path = role === "supplier"
        ? `/blockchain/partnership-nft/supplier/${userId}/${distributorId}`
        : `/blockchain/partnership-nft/retailer/${userId}/${distributorId}`;
      const { data } = await api.get<ApiResponse<DistributorPartnershipNFT>>(path);
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

export function usePartnershipsSummary(partnerType?: "supplier" | "retailer") {
  const role = useAuthStore((s) => s.user?.role);
  const userId = useAuthStore((s) => s.user?.user_id);

  return useQuery({
    queryKey: ["partnerships", "summary", role, userId, partnerType],
    queryFn: async (): Promise<PartnershipsResponse> => {
      const params = new URLSearchParams();
      if (userId) params.set("user_id", userId);
      if (partnerType) params.set("partner_type", partnerType);
      const qs = params.toString();
      const { data } = await api.get<ApiResponse<PartnershipsResponse>>(`/partnerships/summary${qs ? `?${qs}` : ""}`);
      return data.data;
    },
    staleTime: 60 * 1000,
  });
}

// ─── Revoke ────────────────────────────────────────────────────────────────────

export type RevokePartnershipPayload = {
  partnership_pda: string;
};

export type RevokePartnershipResponse = {
  tx_signature: string;
  explorer_url: string;
  on_chain: boolean;
};

export function useRevokePartnershipNFT() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: RevokePartnershipPayload): Promise<RevokePartnershipResponse> => {
      const { data } = await api.post<ApiResponse<RevokePartnershipResponse>>(
        "/blockchain/partnership-nft/revoke",
        payload,
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partnership-nft"] });
      qc.invalidateQueries({ queryKey: ["partnerships"] });
    },
  });
}

// ─── Verify ────────────────────────────────────────────────────────────────────

export type VerifyPartnershipResponse = {
  verified: boolean;
  pda: string;
  tier?: string;
  reason?: string;
};

export function useVerifyPartnership(
  supplier: string | null,
  distributor: string | null,
  role: number = 0,
) {
  return useQuery({
    queryKey: ["partnership-nft", "verify", supplier, distributor, role],
    enabled: !!supplier && !!distributor,
    queryFn: async (): Promise<VerifyPartnershipResponse> => {
      const { data } = await api.get<ApiResponse<VerifyPartnershipResponse>>(
        `/blockchain/partnership-nft/verify/${supplier}/${distributor}?role=${role}`,
      );
      return data.data;
    },
    staleTime: 30 * 1000,
  });
}
