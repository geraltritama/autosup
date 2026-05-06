"use client";

import { ArrowUpRight, Building2, Clock3, Eye, Link2, Loader2, Package, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SupplierTypeBadge } from "@/components/suppliers/supplier-type-badge";
import type { Supplier } from "@/hooks/useSuppliers";

type Props = {
  supplier: Supplier;
  onRequestPartnership?: (supplier: Supplier) => void;
  isRequesting?: boolean;
  isRequested?: boolean;
  onViewStock?: (supplier: Supplier) => void;
};

export function SupplierCard({ supplier, onRequestPartnership, isRequesting, isRequested, onViewStock }: Props) {
  const isPartner = supplier.type === "partner";

  return (
    <Card className="rounded-2xl">
      <CardHeader className="space-y-4 border-b border-[#E2E8F0] pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB]">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-base font-semibold text-[#0F172A]">{supplier.name}</p>
                <p className="text-sm text-[#64748B]">{supplier.category.replace("_", " ")}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <SupplierTypeBadge type={supplier.type} />
              <Badge tone={supplier.is_active ? "success" : "neutral"}>
                {supplier.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2 text-right">
            <p className="text-xs uppercase tracking-[0.18em] text-[#64748B]">Reputation</p>
            <p className="mt-1 text-xl font-semibold text-[#0F172A]">{supplier.reputation_score}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[#64748B]">Transactions</p>
            <p className="mt-2 text-lg font-semibold text-[#0F172A]">{supplier.total_transactions}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[#64748B]">On-time delivery</p>
            <p className="mt-2 text-lg font-semibold text-[#0F172A]">{supplier.on_time_delivery_rate}%</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[#64748B]">Trust reference</p>
            <div className="mt-2 flex items-center gap-2 text-sm font-medium text-[#0F172A]">
              <Wallet className="h-4 w-4 text-[#64748B]" />
              <span className="truncate">{supplier.wallet_address}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
          <div className="flex items-start gap-3">
            {isPartner ? (
              <Link2 className="mt-0.5 h-4 w-4 text-[#22C55E]" />
            ) : (
              <Clock3 className="mt-0.5 h-4 w-4 text-[#3B82F6]" />
            )}
            <div className="space-y-1">
              <p className="text-sm font-medium text-[#0F172A]">
                {isPartner ? "Active partner" : "Available for partnership"}
              </p>
              <p className="text-sm leading-6 text-[#64748B]">
                {isPartner
                  ? "You're connected with this supplier. Trust layer is managed by the backend."
                  : "Request a partnership to unlock ordering, trust scoring, and secure transactions."}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {isPartner ? (
            <>
              <Button className="gap-2" onClick={() => onViewStock?.(supplier)}>
                <Package className="h-4 w-4" />
                View Stock
              </Button>
              <Button variant="ghost" className="gap-2 text-[#22C55E]" disabled>
                <Link2 className="h-4 w-4" />
                Partnered
              </Button>
            </>
          ) : isRequested ? (
            <Button variant="secondary" className="gap-2" disabled>
              <Clock3 className="h-4 w-4" />
              Requested
            </Button>
          ) : (
            <>
              <Button
                onClick={() => onRequestPartnership?.(supplier)}
                disabled={isRequesting || !supplier.is_active}
                className="gap-2"
              >
                {isRequesting && <Loader2 className="h-4 w-4 animate-spin" />}
                Request Partnership
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
