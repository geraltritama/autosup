"use client";

import { CheckCircle2, Clock3, ExternalLink, Gem, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePartnershipsSummary } from "@/hooks/usePartnerships";

export function SuppliersTrustPanel() {
  const { data, isLoading } = usePartnershipsSummary("supplier");
  const summary = data?.summary;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="space-y-3">
        <Badge tone="info" className="w-fit">
          Trust and partnership
        </Badge>
        <CardTitle className="text-lg">Partnership trust layer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* NFT issued */}
        <div className="flex items-start gap-3 rounded-xl border border-[#DDD6FE] bg-[#F5F3FF] p-4">
          <Gem className="mt-0.5 h-5 w-5 text-[#7C3AED]" />
          <div className="flex-1">
            <p className="text-sm font-medium text-[#0F172A]">Partnership NFT on-chain</p>
            <p className="mt-1 text-sm text-[#64748B]">
              Soulbound NFTs are issued when partnerships are approved — recorded on-chain on Solana Devnet.
            </p>
            {isLoading ? (
              <div className="mt-2 h-4 w-24 animate-pulse rounded bg-slate-200" />
            ) : (
              <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#EDE9FE] px-3 py-1.5">
                <span className="text-xl font-bold text-[#7C3AED]">{summary?.nft_issued ?? 0}</span>
                <span className="text-xs text-[#6D28D9]">NFTs issued</span>
              </div>
            )}
          </div>
        </div>

        {/* Active partnerships */}
        <div className="flex items-start gap-3 rounded-xl border border-[#E2E8F0] p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-[#3B82F6]" />
          <div className="flex-1">
            <p className="text-sm font-medium text-[#0F172A]">Backend-driven verification</p>
            <p className="mt-1 text-sm text-[#64748B]">
              Trust layer managed by backend — UI displays mint address & explorer link without browser wallet flow.
            </p>
            {isLoading ? (
              <div className="mt-2 h-4 w-32 animate-pulse rounded bg-slate-200" />
            ) : (
              <div className="mt-3 flex gap-3">
                <div className="rounded-lg bg-[#F0FDF4] px-3 py-1.5 text-center">
                  <p className="text-xs text-[#64748B]">Active</p>
                  <p className="text-lg font-bold text-[#16A34A]">{summary?.active_partnerships ?? 0}</p>
                </div>
                <div className="rounded-lg bg-[#FFF7ED] px-3 py-1.5 text-center">
                  <p className="text-xs text-[#64748B]">Pending</p>
                  <p className="text-lg font-bold text-[#EA580C]">{summary?.pending_agreements ?? 0}</p>
                </div>
                <div className="rounded-lg bg-[#EFF6FF] px-3 py-1.5 text-center">
                  <p className="text-xs text-[#64748B]">Trust score</p>
                  <p className="text-lg font-bold text-[#1D4ED8]">{summary?.trust_score ?? 0}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pending */}
        <div className="flex items-start gap-3 rounded-xl border border-[#E2E8F0] p-4">
          <Clock3 className="mt-0.5 h-5 w-5 text-[#F59E0B]" />
          <div className="flex-1">
            <p className="text-sm font-medium text-[#0F172A]">Renewal & network growth</p>
            <p className="mt-1 text-sm text-[#64748B]">
              Renewal rate and network growth are calculated from actual partnership data.
            </p>
            {isLoading ? (
              <div className="mt-2 h-4 w-24 animate-pulse rounded bg-slate-200" />
            ) : (
              <div className="mt-3 flex gap-3">
                <div className="rounded-lg bg-slate-50 px-3 py-1.5 text-center">
                  <p className="text-xs text-[#64748B]">Renewal</p>
                  <p className="text-lg font-bold text-[#0F172A]">{summary?.contract_renewal_rate ?? 0}%</p>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-1.5 text-center">
                  <p className="text-xs text-[#64748B]">Growth</p>
                  <p className="text-lg font-bold text-[#0F172A]">+{summary?.network_growth ?? 0}%</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Explorer CTA */}
        <div className="flex items-start gap-3 rounded-xl border border-[#E2E8F0] p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-[#22C55E]" />
          <div>
            <p className="text-sm font-medium text-[#0F172A]">Operational trust signal</p>
            <p className="mt-1 text-sm text-[#64748B]">
              Each partnership NFT has a mint address and Solana Devnet explorer link — click the Explorer icon on the partner card to view.
            </p>
            <a
              href="https://explorer.solana.com/?cluster=devnet"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#7C3AED] hover:underline"
            >
              Solana Devnet Explorer <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
