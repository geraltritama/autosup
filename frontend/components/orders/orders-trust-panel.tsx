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

export function OrdersTrustPanel({ view }: { view?: "outgoing" | "incoming" }) {
  const role = useAuthStore((s) => s.user?.role);
  const { data, isLoading } = useOrdersTrustSummary(view);

  const escrowReleased = data?.escrow_released ?? 0;
  const escrowHeld = data?.escrow_held ?? 0;
  const escrowRefunded = data?.escrow_refunded ?? 0;
  const totalReleasedValue = data?.total_released_value ?? 0;
  const reputationScore = data?.reputation_score ?? 0;

  const reputationLabel = role === "supplier"
    ? "Supplier reputation"
    : view === "outgoing"
      ? "Payment reliability (as buyer)"
      : "Your reputation (as seller)";

  // For outgoing view, calculate payment reliability from escrow data
  const displayScore = view === "outgoing"
    ? (escrowReleased + escrowRefunded > 0 ? Math.round((escrowReleased / Math.max(escrowReleased + escrowHeld, 1)) * 100) : 0)
    : reputationScore;
  const scoreLabel = view === "outgoing" ? "%" : "reputation points";

  return (
    <Card className="rounded-2xl">
      <CardHeader className="space-y-3">
        <Badge tone="info" className="w-fit">
          Transaction Summary
        </Badge>
        <CardTitle className="text-lg">Payment & Trust</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Escrow status */}
        <div className="flex items-start gap-3 rounded-xl border border-[#E2E8F0] p-4">
          <WalletCards className="mt-0.5 h-5 w-5 text-[#3B82F6]" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#0F172A]">Payment Protection</p>
            <p className="mt-1 text-sm text-[#64748B]">
              {view === "outgoing"
                ? "Your payments are held securely until the order is delivered. If cancelled, your money is returned automatically."
                : view === "incoming"
                  ? "Buyer payments are held until you deliver the order. Once confirmed delivered, funds are released to you."
                  : "Payments are protected with automatic escrow. Released on delivery, refunded on cancellation."}
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
                Cancelled orders are refunded. Held means payment is waiting for delivery confirmation.
              </div>
            )}
          </div>
        </div>

        {/* Reputation */}
        <div className="flex items-start gap-3 rounded-xl border border-[#E2E8F0] p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-[#22C55E]" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#0F172A]">
              {reputationLabel}
            </p>
            <p className="mt-1 text-sm text-[#64748B]">
              {view === "outgoing"
                ? "Shows how reliably you complete payments. Higher score means suppliers trust you more."
                : "Your score based on delivery speed, completion rate, and partner satisfaction. Updated after every completed order."}
            </p>
            {isLoading ? (
              <div className="mt-2 h-4 w-24 animate-pulse rounded bg-slate-200" />
            ) : (
              <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#F0FDF4] px-3 py-1.5">
                <span className="text-2xl font-bold text-[#16A34A]">{displayScore}</span>
                <span className="text-xs text-[#64748B]">{scoreLabel}</span>
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
