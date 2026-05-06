"use client";

import { Building2, ShoppingBag, TrendingUp, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Retailer } from "@/hooks/useRetailers";

const segmentLabel: Record<Retailer["segment"], string> = {
  premium: "Premium",
  regular: "Regular",
  new: "New",
};

const segmentTone: Record<Retailer["segment"], "info" | "success" | "warning"> = {
  premium: "success",
  regular: "info",
  new: "warning",
};

const statusLabel: Record<Retailer["status"], string> = {
  active: "Active",
  inactive: "Inactive",
  high_risk: "High Risk",
};

const statusTone: Record<Retailer["status"], "success" | "neutral" | "danger"> = {
  active: "success",
  inactive: "neutral",
  high_risk: "danger",
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
    notation: "compact",
  }).format(amount);
}

type Props = {
  retailer: Retailer;
  onViewDetail?: (retailer: Retailer) => void;
};

export function RetailerCard({ retailer, onViewDetail }: Props) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="space-y-4 border-b border-[#E2E8F0] pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB]">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <div>
                <p className="text-base font-semibold text-[#0F172A]">{retailer.name}</p>
                <p className="text-sm text-[#64748B]">{retailer.city}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone={segmentTone[retailer.segment]}>{segmentLabel[retailer.segment]}</Badge>
              <Badge tone={statusTone[retailer.status]}>{statusLabel[retailer.status]}</Badge>
            </div>
          </div>
          {retailer.status === "high_risk" && (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-[#EF4444]">
              <AlertTriangle className="h-5 w-5" />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[#64748B]">Order/bulan</p>
            <p className="mt-2 text-lg font-semibold text-[#0F172A]">{retailer.monthly_order_volume}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[#64748B]">Total pembelian</p>
            <p className="mt-2 text-lg font-semibold text-[#0F172A]">{formatCurrency(retailer.total_purchase_amount)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[#64748B]">Terakhir order</p>
            <p className="mt-2 text-sm font-semibold text-[#0F172A]">
              {new Date(retailer.last_order_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-[#64748B]">
          <Building2 className="h-4 w-4" />
          <span>{retailer.contact_person}</span>
          <span className="text-[#94A3B8]">·</span>
          <span>{retailer.phone}</span>
        </div>

        {onViewDetail && (
          <button
            onClick={() => onViewDetail(retailer)}
            className="text-sm font-medium text-[#3B82F6] hover:underline"
          >
            Lihat detail →
          </button>
        )}
      </CardContent>
    </Card>
  );
}