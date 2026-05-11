"use client";

import { CheckCircle2, ShieldCheck, WalletCards } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useOrdersTrustSummary } from "@/hooks/useOrders";
import { useAuthStore } from "@/store/useAuthStore";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function OrdersTrustPanel() {
  const role = useAuthStore((s) => s.user?.role);
  const { data, isLoading } = useOrdersTrustSummary();

  const escrowReleased = data?.escrow_released ?? 0;
  const escrowHeld = data?.escrow_held ?? 0;
  const escrowRefunded = data?.escrow_refunded ?? 0;
  const totalReleasedValue = data?.total_released_value ?? 0;
  const reputationScore = data?.reputation_score ?? 0;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="space-y-3">
        <Badge tone="info" className="w-fit">
          Backend outcome
        </Badge>
        <CardTitle className="text-lg">Escrow and reputation outcome</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Escrow status */}
        <div className="flex items-start gap-3 rounded-xl border border-[#E2E8F0] p-4">
          <WalletCards className="mt-0.5 h-5 w-5 text-[#3B82F6]" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#0F172A]">Escrow (backend-managed)</p>
            <p className="mt-1 text-sm text-[#64748B]">
              Escrow is released automatically when an order reaches <span className="font-medium text-[#0F172A]">delivered</span>. Cancelled orders are refunded automatically to the buyer.
            </p>
            {isLoading ? (
              <div className="mt-2 h-4 w-32 animate-pulse rounded bg-slate-200" />
            ) : (
              <div className="mt-3 flex flex-wrap gap-3">
                <div className="rounded-lg bg-[#F0FDF4] px-3 py-1.5 text-center">
                  <p className="text-xs text-[#64748B]">Released</p>
                  <p className="text-lg font-bold text-[#16A34A]">{escrowReleased}</p>
                </div>
                <div className="rounded-lg bg-[#FFF7ED] px-3 py-1.5 text-center">
                  <p className="text-xs text-[#64748B]">Held</p>
                  <p className="text-lg font-bold text-[#EA580C]">{escrowHeld}</p>
                </div>
                <div className="rounded-lg bg-[#FEF2F2] px-3 py-1.5 text-center">
                  <p className="text-xs text-[#64748B]">Refunded</p>
                  <p className="text-lg font-bold text-[#DC2626]">{escrowRefunded}</p>
                </div>
                {escrowReleased > 0 && (
                  <div className="rounded-lg bg-[#EFF6FF] px-3 py-1.5 text-center">
                    <p className="text-xs text-[#64748B]">Total released</p>
                    <p className="text-base font-bold text-[#1D4ED8]">{formatCurrency(totalReleasedValue)}</p>
                  </div>
                )}
              </div>
            )}
            {!isLoading && escrowRefunded > 0 && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                Cancelled orders are not counted as held funds. Refunded escrow means the buyer funds have been returned.
              </div>
            )}
          </div>
        </div>

        {/* Reputation */}
        <div className="flex items-start gap-3 rounded-xl border border-[#E2E8F0] p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-[#22C55E]" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#0F172A]">
              {role === "supplier" ? "Supplier reputation" : "Reputation sistem"}
            </p>
            <p className="mt-1 text-sm text-[#64748B]">
              Reputation updates happen automatically when an order is completed — recorded by the backend on every successful delivery.
            </p>
            {isLoading ? (
              <div className="mt-2 h-4 w-24 animate-pulse rounded bg-slate-200" />
            ) : (
              <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#F0FDF4] px-3 py-1.5">
                <span className="text-2xl font-bold text-[#16A34A]">{reputationScore}</span>
                <span className="text-xs text-[#64748B]">reputation points</span>
              </div>
            )}
          </div>
        </div>

        {/* Blockchain footnote */}
        <p className="text-[10px] text-[#94A3B8] text-center pt-2">
          🔒 Semua verifikasi blockchain berjalan otomatis. Tidak perlu install aplikasi tambahan.
        </p>
      </CardContent>
    </Card>
  );
}
