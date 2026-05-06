"use client";

import { useState } from "react";
import { LegacyDialog as Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ShippingInfo = {
  courier: string;
  tracking_number: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  orderNumber: string;
  newStatus: string;
  onUpdate: (shippingInfo?: ShippingInfo) => void;
  isLoading?: boolean;
};

const COURIERS = ["JNE", "J&T Express", "GrabExpress", "Gojek", "ShopeeExpress", "Tiket.com", "Lainnya"];

export function OrderStatusUpdateDialog({ open, onClose, orderNumber, newStatus, onUpdate, isLoading }: Props) {
  const [shippingInfo, setShippingInfo] = useState<ShippingInfo>({ courier: "", tracking_number: "" });
  const [error, setError] = useState<string | null>(null);

  const isShipped = newStatus === "shipping";
  const canSubmit = !isShipped || (shippingInfo.courier.trim() && shippingInfo.tracking_number.trim());

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isShipped && (!shippingInfo.courier.trim() || !shippingInfo.tracking_number.trim())) {
      setError("Mohon isi informasi pengiriman");
      return;
    }
    onUpdate(isShipped ? shippingInfo : undefined);
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      setShippingInfo({ courier: "", tracking_number: "" });
      setError(null);
    }
    onClose();
  }

  const statusLabel: Record<string, string> = {
    processing: "Processing",
    shipped: "Shipped",
    delivered: "Delivered",
    cancelled: "Cancelled",
  };

  return (
    <Dialog
      open={open}
      onClose={() => handleOpenChange(false)}
      title={`Kirim Barang - Order ${orderNumber}`}
      description={`Masukkan informasi pengiriman untuk menandai barang sebagai "${statusLabel[newStatus] || newStatus}".`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {isShipped && (
          <div className="space-y-3 rounded-xl border border-[#E2E8F0] bg-slate-50 p-4">
            <p className="text-sm font-medium text-[#0F172A]">Informasi Pengiriman</p>
            <div className="space-y-2">
              <div className="space-y-1">
                <label className="text-xs text-[#64748B]">Ekspedisi</label>
                <select
                  className="h-11 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm text-[#0F172A] outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#BFDBFE]"
                  value={shippingInfo.courier}
                  onChange={(e) => setShippingInfo({ ...shippingInfo, courier: e.target.value })}
                  required={isShipped}
                >
                  <option value="">Pilih ekspedisi</option>
                  {COURIERS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-[#64748B]">Nomor Resi</label>
                <Input
                  placeholder="cth: JNE123456789"
                  value={shippingInfo.tracking_number}
                  onChange={(e) => setShippingInfo({ ...shippingInfo, tracking_number: e.target.value })}
                  required={isShipped}
                />
              </div>
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-[#DC2626]">{error}</p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)} disabled={isLoading}>
            Batal
          </Button>
          <Button type="submit" disabled={isLoading || !canSubmit}>
            {isLoading ? "Mengirim..." : `Kirim Barang`}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}