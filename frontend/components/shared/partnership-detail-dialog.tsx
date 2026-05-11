"use client";

import { ExternalLink, FileText, Hash, Loader2, MapPin, Phone, Mail, Star } from "lucide-react";
import { LegacyDialog as Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";

type PartnershipDetail = {
  id: string;
  type: string;
  status: string;
  partner_id: string;
  mou_terms: string;
  mou_region: string;
  mou_hash: string;
  nft_mint_address: string | null;
  nft_token_name: string | null;
  nft_explorer_url: string | null;
  created_at: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  partnerId: string | null;
  partnerName: string;
  partnerRole: "supplier" | "retailer";
  partnerInfo?: {
    city?: string;
    phone?: string;
    email?: string;
    order_volume?: number;
    punctuality?: number;
    reputation?: number;
    transactions?: number;
  };
};

function usePartnershipDetail(partnerId: string | null) {
  const userId = useAuthStore((s) => s.user?.user_id);
  return useQuery({
    queryKey: ["partnership-detail", partnerId, userId],
    enabled: !!partnerId,
    queryFn: async (): Promise<PartnershipDetail | null> => {
      const { data } = await api.get<ApiResponse<{ partnerships: PartnershipDetail[] }>>(
        `/partnerships/list`,
      );
      const all = data.data?.partnerships ?? [];
      return all.find((p) => p.partner_id === partnerId && p.status === "accepted") ?? null;
    },
    staleTime: 30 * 1000,
  });
}

export function PartnershipDetailDialog({ open, onClose, partnerId, partnerName, partnerRole, partnerInfo }: Props) {
  const { data: partnership, isLoading } = usePartnershipDetail(open ? partnerId : null);

  return (
    <Dialog open={open} onClose={onClose} title="Partnership Detail" description={`Partnership information with ${partnerName}`}>
      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[#0F172A]">{partnerName}</h3>
            <p className="text-sm text-[#64748B] capitalize">{partnerRole}</p>
          </div>
          <Badge tone="success">Partner</Badge>
        </div>

        {/* Contact */}
        {(partnerInfo?.city || partnerInfo?.phone || partnerInfo?.email) && (
          <div className="rounded-xl border border-[#E2E8F0] p-4 space-y-2">
            {partnerInfo.city && (
              <div className="flex items-center gap-2 text-sm text-[#64748B]">
                <MapPin className="h-4 w-4" /> {partnerInfo.city}
              </div>
            )}
            {partnerInfo.phone && (
              <div className="flex items-center gap-2 text-sm text-[#64748B]">
                <Phone className="h-4 w-4" /> {partnerInfo.phone}
              </div>
            )}
            {partnerInfo.email && (
              <div className="flex items-center gap-2 text-sm text-[#64748B]">
                <Mail className="h-4 w-4" /> {partnerInfo.email}
              </div>
            )}
          </div>
        )}

        {/* MOU & NFT */}
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-[#94A3B8]" /></div>
        ) : partnership ? (
          <div className="space-y-3">
            {/* MOU */}
            {partnership.mou_terms && (
              <div className="rounded-xl bg-slate-50 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#64748B]" />
                  <p className="text-xs font-medium text-[#64748B]">MOU Terms</p>
                </div>
                <p className="text-sm leading-relaxed text-[#0F172A]">{partnership.mou_terms}</p>
                {partnership.mou_region && (
                  <p className="text-xs text-[#64748B]">Region: <span className="text-[#0F172A] font-medium">{partnership.mou_region}</span></p>
                )}
              </div>
            )}

            {/* MOU Hash */}
            {partnership.mou_hash && (
              <div className="rounded-lg border border-[#DDD6FE] bg-[#F5F3FF] px-3 py-2">
                <div className="flex items-center gap-2 text-xs text-[#64748B]">
                  <Hash className="h-3.5 w-3.5" /> MOU Hash (On-Chain)
                </div>
                <p className="mt-1 font-mono text-xs text-[#7C3AED] break-all">{partnership.mou_hash}</p>
              </div>
            )}

            {/* NFT */}
            {partnership.nft_mint_address && (
              <div className="rounded-lg border border-[#DBEAFE] bg-[#EFF6FF] px-3 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#2563EB] text-white">
                      <Star className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#1E40AF]">{partnership.nft_token_name || "Partnership NFT"}</p>
                      <p className="text-[10px] text-[#64748B]">Minted {new Date(partnership.created_at).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-md bg-white px-2.5 py-2 space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-[#64748B]">Mint Address</span>
                    <span className="font-mono text-[#0F172A]">{partnership.nft_mint_address.slice(0, 16)}...</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-[#64748B]">Network</span>
                    <span className="text-[#0F172A]">Solana Devnet</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[10px] text-emerald-600">
                    <span>✅ Verified</span>
                    <span>✅ Soulbound</span>
                  </div>
                  {partnership.nft_explorer_url && (
                    <a href={partnership.nft_explorer_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#2563EB] hover:underline flex items-center gap-1">
                      View on-chain <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-[#94A3B8] text-center py-4">No partnership data found.</p>
        )}

        {/* Business Metrics */}
        {partnerInfo && (
          <div className="grid grid-cols-2 gap-3">
            {partnerInfo.order_volume != null && (
              <div className="rounded-xl bg-slate-50 p-3 text-center">
                <p className="text-2xl font-bold text-[#0F172A]">{partnerInfo.order_volume}</p>
                <p className="text-[10px] text-[#64748B]">Order Volume</p>
              </div>
            )}
            {partnerInfo.punctuality != null && (
              <div className="rounded-xl bg-slate-50 p-3 text-center">
                <p className="text-2xl font-bold text-[#0F172A]">{partnerInfo.punctuality}%</p>
                <p className="text-[10px] text-[#64748B]">{partnerRole === "supplier" ? "On-time Delivery" : "Payment Punctuality"}</p>
              </div>
            )}
            {partnerInfo.reputation != null && partnerInfo.reputation > 0 && (
              <div className="rounded-xl bg-slate-50 p-3 text-center">
                <p className="text-2xl font-bold text-[#0F172A]">{partnerInfo.reputation}</p>
                <p className="text-[10px] text-[#64748B]">Reputation</p>
              </div>
            )}
            {partnerInfo.transactions != null && partnerInfo.transactions > 0 && (
              <div className="rounded-xl bg-slate-50 p-3 text-center">
                <p className="text-2xl font-bold text-[#0F172A]">{partnerInfo.transactions}</p>
                <p className="text-[10px] text-[#64748B]">Total Transactions</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
