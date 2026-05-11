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


// ─── NEW PARTNERSHIP SYSTEM ───────────────────────────────────────────────────

export type Partnership = {
  id: string;
  type: "supplier_distributor" | "distributor_retailer";
  status: "pending" | "accepted" | "rejected" | "terminated";
  partner_id: string;
  partner_name: string;
  is_requester: boolean;
  mou_terms: string;
  mou_region: string;
  mou_valid_until: string | null;
  mou_hash: string;
  nft_mint_address: string | null;
  nft_token_name: string | null;
  nft_explorer_url: string | null;
  created_at: string;
};

export type PartnershipListResponse = {
  partnerships: Partnership[];
  summary: {
    total_active: number;
    total_pending: number;
    supplier_partners: number;
    retailer_partners: number;
    nft_count: number;
  };
};

export function usePartnershipList() {
  return useQuery({
    queryKey: ["partnerships", "list"],
    queryFn: async (): Promise<PartnershipListResponse> => {
      const { data } = await api.get<ApiResponse<PartnershipListResponse>>("/partnerships/list");
      return data.data;
    },
    staleTime: 30 * 1000,
  });
}

export function useRequestPartnership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      type: "supplier_distributor" | "distributor_retailer";
      approver_id: string;
      mou_terms: string;
      mou_region: string;
      mou_valid_until?: string;
    }) => {
      const { data } = await api.post<ApiResponse<{ partnership_id: string; mou_hash: string }>>("/partnerships/request", payload);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partnerships"] });
    },
  });
}

export function useRespondPartnership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ partnershipId, action }: { partnershipId: string; action: "accept" | "reject" }) => {
      const { data } = await api.put<ApiResponse<{ partnership_id: string; action: string; nft: unknown }>>(`/partnerships/${partnershipId}/respond`, { action });
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partnerships"] });
    },
  });
}

export function useTerminatePartnership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (partnershipId: string) => {
      const { data } = await api.post<ApiResponse>(`/partnerships/${partnershipId}/terminate`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partnerships"] });
    },
  });
}
