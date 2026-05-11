"use client";

import { ArrowUpRight, Building2, Clock3, Link2, Loader2, Eye, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Distributor } from "@/hooks/useDistributors";

type Props = {
  distributor: Distributor;
  role?: "retailer" | "supplier";
  onRequestPartnership?: (distributor: Distributor) => void;
  onViewStock?: (distributor: Distributor) => void;
  onViewDetail?: (distributor: Distributor) => void;
  onDeletePartnership?: (distributor: Distributor) => void;
  isRequesting?: boolean;
};

export function DistributorCard({ distributor, role = "supplier", onRequestPartnership, onViewStock, onViewDetail, onDeletePartnership, isRequesting }: Props) {
  const isPartner = distributor.partnership_status === "partner";

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
                <p className="text-base font-semibold text-[#0F172A]">{distributor.name}</p>
                <p className="text-sm text-[#64748B]">{distributor.region}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone={isPartner ? "success" : distributor.partnership_status === "pending" ? "warning" : "neutral"}>
                {isPartner ? "Partner" : distributor.partnership_status === "pending" ? "Pending" : "Not Partnered"}
              </Badge>
              <Badge tone={distributor.is_active ? "success" : "neutral"}>
                {distributor.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2 text-right">
            <p className="text-xs uppercase tracking-[0.18em] text-[#64748B]">Reputation</p>
            <p className="mt-1 text-xl font-semibold text-[#0F172A]">{distributor.reputation_score}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-5">
        {isPartner && (
          <div className="grid gap-3 sm:grid-cols-2">
            {role === "retailer" ? (
              <>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#64748B]">Avg. Delivery</p>
                  <p className="mt-2 text-lg font-semibold text-[#0F172A]">{distributor.avg_delivery_days} days</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#64748B]">On-time Delivery</p>
                  <p className="mt-2 text-lg font-semibold text-[#22C55E]">{distributor.on_time_delivery_rate}%</p>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#64748B]">Order Volume</p>
                  <p className="mt-2 text-lg font-semibold text-[#0F172A]">{distributor.order_volume}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#64748B]">Punctuality</p>
                  <p className="mt-2 text-lg font-semibold text-[#22C55E]">{distributor.payment_punctuality}%</p>
                </div>
              </>
            )}
          </div>
        )}

        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
          <div className="flex items-start gap-3">
            {isPartner ? (
              <Link2 className="mt-0.5 h-4 w-4 text-[#22C55E]" />
            ) : (
              <Clock3 className="mt-0.5 h-4 w-4 text-[#3B82F6]" />
            )}
            <div className="space-y-1">
              <p className="text-sm font-medium text-[#0F172A]">
                {isPartner ? "Active partnership with this distributor" : "Available for partnership request"}
              </p>
              <p className="text-sm leading-6 text-[#64748B]">
                {isPartner
                  ? "This distributor is an active partner. View stock and create orders directly."
                  : "Send a partnership request to start transacting with this distributor."}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {onViewDetail && (
            <Button variant="secondary" className="gap-2" onClick={() => onViewDetail(distributor)}>
              <Eye className="h-4 w-4" />
              View Detail
            </Button>
          )}
          {isPartner ? (
            <>
              {onViewStock && (
                <Button variant="secondary" className="gap-2" onClick={() => onViewStock(distributor)}>
                  View Stock
                </Button>
              )}
              <Button variant="ghost" className="gap-2 text-[#22C55E]" disabled>
                Partnered
                <ArrowUpRight className="h-4 w-4" />
              </Button>
              {onDeletePartnership && (
                <Button
                  variant="ghost"
                  className="gap-2 text-red-500 hover:text-red-600 hover:bg-red-50"
                  onClick={() => onDeletePartnership(distributor)}
                >
                  <Trash2 className="h-4 w-4" />
                  End Partnership
                </Button>
              )}
            </>
          ) : distributor.partnership_status === "pending" ? (
            <>
              <Button variant="secondary" className="gap-2" disabled>
                <Clock3 className="h-4 w-4" />
                Requested
              </Button>
              {onDeletePartnership && (
                <Button
                  variant="ghost"
                  className="gap-2 text-red-500 hover:text-red-600 hover:bg-red-50"
                  onClick={() => onDeletePartnership(distributor)}
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
              )}
            </>
          ) : (
            <>
              {onRequestPartnership && (
                <Button
                  onClick={() => onRequestPartnership(distributor)}
                  disabled={isRequesting || !distributor.is_active}
                  className="gap-2"
                >
                  {isRequesting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Request Partnership
                </Button>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}