import { ArrowUpRight, Building2, Clock3, Link2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SupplierTypeBadge, type SupplierType } from "@/components/suppliers/supplier-type-badge";

export interface SupplierCardData {
  supplier_id: string;
  name: string;
  category: string;
  type: SupplierType;
  reputation_score: number;
  total_transactions: number;
  on_time_delivery_rate: number;
  wallet_address: string;
  is_active: boolean;
}

export function SupplierCard({ supplier }: { supplier: SupplierCardData }) {
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
                <p className="text-sm text-[#64748B]">{supplier.category}</p>
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
            <p className="mt-1 text-xl font-semibold text-[#0F172A]">
              {supplier.reputation_score}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[#64748B]">
              Transactions
            </p>
            <p className="mt-2 text-lg font-semibold text-[#0F172A]">
              {supplier.total_transactions}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[#64748B]">
              On-time delivery
            </p>
            <p className="mt-2 text-lg font-semibold text-[#0F172A]">
              {supplier.on_time_delivery_rate}%
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[#64748B]">
              Trust reference
            </p>
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
                {isPartner
                  ? "Trust-backed partnership is active"
                  : "Ready for partnership request flow"}
              </p>
              <p className="text-sm leading-6 text-[#64748B]">
                {isPartner
                  ? "Kemitraan ini diposisikan sebagai hubungan aktif dengan trust layer yang dikelola backend."
                  : "Supplier ini tersedia di discover list dan bisa masuk ke flow partnership request tanpa browser-side blockchain action."}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {isPartner ? (
            <>
              <Button variant="secondary">View Profile</Button>
              <Button variant="ghost" className="gap-2 text-[#0F172A]">
                Partnered
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button>Request Partnership</Button>
              <Button variant="secondary">View Profile</Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
