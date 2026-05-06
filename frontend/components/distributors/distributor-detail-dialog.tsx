"use client";

import { MapPin, Phone, Mail, User, PackageOpen, Percent, Star, TrendingUp, Truck } from "lucide-react";
import { LegacyDialog as Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { Distributor } from "@/hooks/useDistributors";

type Props = {
  open: boolean;
  onClose: () => void;
  distributor: Distributor | null;
  role?: "retailer" | "supplier";
};

const statusLabel: Record<Distributor["partnership_status"], string> = {
  partner: "Partner",
  pending: "Menunggu",
  none: "Belum Terkait",
};

const statusTone: Record<Distributor["partnership_status"], "success" | "warning" | "neutral"> = {
  partner: "success",
  pending: "warning",
  none: "neutral",
};

export function DistributorDetailDialog({ open, onClose, distributor, role = "supplier" }: Props) {
  if (!distributor) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Detail Distributor"
      description={`Informasi lengkap tentang ${distributor.name}`}
    >
      <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-2">
        {/* Header - Name & Status */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[#0F172A]">{distributor.name}</h3>
            <p className="text-sm text-[#64748B]">{distributor.business_name}</p>
          </div>
          <Badge tone={statusTone[distributor.partnership_status]}>
            {statusLabel[distributor.partnership_status]}
          </Badge>
        </div>

        {/* Company Info */}
        {distributor.address && (
          <div className="rounded-xl border border-[#E2E8F0] p-4 space-y-2">
            <p className="text-xs uppercase tracking-[0.15em] text-[#64748B]">Alamat</p>
            <div className="flex items-start gap-2 text-sm text-[#0F172A]">
              <MapPin className="h-4 w-4 shrink-0 text-[#64748B]" />
              <span>{distributor.address}</span>
            </div>
          </div>
        )}

        {/* Contact Info */}
        {(distributor.contact_person || distributor.phone || distributor.email) && (
          <div className="rounded-xl border border-[#E2E8F0] p-4 space-y-3">
            <p className="text-xs uppercase tracking-[0.15em] text-[#64748B]">Kontak</p>
            {distributor.contact_person && (
              <div className="flex items-center gap-2 text-sm text-[#0F172A]">
                <User className="h-4 w-4 shrink-0 text-[#64748B]" />
                <span>{distributor.contact_person}</span>
              </div>
            )}
            {distributor.phone && (
              <div className="flex items-center gap-2 text-sm text-[#0F172A]">
                <Phone className="h-4 w-4 shrink-0 text-[#64748B]" />
                <span>{distributor.phone}</span>
              </div>
            )}
            {distributor.email && (
              <div className="flex items-center gap-2 text-sm text-[#0F172A]">
                <Mail className="h-4 w-4 shrink-0 text-[#64748B]" />
                <span>{distributor.email}</span>
              </div>
            )}
          </div>
        )}

        {/* Region & Join Date */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-[#64748B]">Wilayah</p>
            <p className="text-sm font-medium text-[#0F172A]">{distributor.region}</p>
          </div>
          {distributor.joined_at && (
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-[#64748B]">Menjadi Partner</p>
              <p className="text-sm font-medium text-[#0F172A]">
                {new Date(distributor.joined_at).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
          )}
        </div>

        {/* Business Metrics */}
        <div className="rounded-xl border border-[#E2E8F0] p-4">
          <p className="text-xs uppercase tracking-[0.15em] text-[#64748B] mb-3">Metrik Bisnis</p>
          <div className="grid grid-cols-2 gap-3">
            {role === "retailer" ? (
              <>
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <Truck className="h-4 w-4 mx-auto text-[#64748B] mb-1" />
                  <p className="text-lg font-semibold text-[#0F172A]">{distributor.avg_delivery_days} hari</p>
                  <p className="text-xs text-[#64748B]">Avg. Delivery</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <Star className="h-4 w-4 mx-auto text-[#64748B] mb-1" />
                  <p className="text-lg font-semibold text-[#0F172A]">{distributor.reputation_score}</p>
                  <p className="text-xs text-[#64748B]">Reputation</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <Percent className="h-4 w-4 mx-auto text-[#64748B] mb-1" />
                  <p className="text-lg font-semibold text-[#22C55E]">{distributor.on_time_delivery_rate}%</p>
                  <p className="text-xs text-[#64748B]">On-time Delivery</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <PackageOpen className="h-4 w-4 mx-auto text-[#64748B] mb-1" />
                  <p className="text-lg font-semibold text-[#0F172A]">{distributor.order_volume}</p>
                  <p className="text-xs text-[#64748B]">Pesanan Saya</p>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <PackageOpen className="h-4 w-4 mx-auto text-[#64748B] mb-1" />
                  <p className="text-lg font-semibold text-[#0F172A]">{distributor.order_volume}</p>
                  <p className="text-xs text-[#64748B]">Order Volume</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <Percent className="h-4 w-4 mx-auto text-[#64748B] mb-1" />
                  <p className="text-lg font-semibold text-[#0F172A]">{distributor.payment_punctuality}%</p>
                  <p className="text-xs text-[#64748B]">On-time Payment</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <Star className="h-4 w-4 mx-auto text-[#64748B] mb-1" />
                  <p className="text-lg font-semibold text-[#0F172A]">{distributor.reputation_score}</p>
                  <p className="text-xs text-[#64748B]">Reputation</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <TrendingUp className="h-4 w-4 mx-auto text-[#64748B] mb-1" />
                  <p className="text-lg font-semibold text-[#0F172A]">{distributor.total_transactions}</p>
                  <p className="text-xs text-[#64748B]">Total Transaksi</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
}