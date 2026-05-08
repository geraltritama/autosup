"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, CreditCard, Loader2, Plus, Trash2 } from "lucide-react";
import { LegacyDialog as Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateOrder, type CreateOrderPayload } from "@/hooks/useOrders";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useDistributors } from "@/hooks/useDistributors";
import { useSellerInventory } from "@/hooks/useInventory";
import { useAuthStore } from "@/store/useAuthStore";


type OrderItem = {
  item_name: string;
  qty: number;
  qtyStr: string;
  unit: string;
  price_per_unit: number;
};

const emptyItem = (): OrderItem => ({
  item_name: "",
  qty: 1,
  qtyStr: "1",
  unit: "kg",
  price_per_unit: 0,
});

type OrderPrefill = {
  sellerId?: string;
  sellerType?: "supplier" | "distributor";
  itemName?: string;
  qty?: number;
  unit?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  prefill?: OrderPrefill;
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

type Step = "form" | "payment" | "success";

export function OrderFormDialog({ open, onClose, prefill }: Props) {
  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  const [step, setStep] = useState<Step>("form");
  const [pendingPayload, setPendingPayload] = useState<CreateOrderPayload | null>(null);
  const [sellerId, setSellerId] = useState("");
  const [items, setItems] = useState<OrderItem[]>([emptyItem()]);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = useCreateOrder();
  const isLoading = create.isPending;

  const isRetailer = role === "retailer";
  const sellerType = isRetailer ? "distributor" as const : "supplier" as const;

  const { data: suppliersData, isLoading: suppliersLoading } = useSuppliers({ type: "partner" });
  const { data: distributorsData, isLoading: distributorsLoading } = useDistributors({ status: "partner" });
  const { data: sellerInventory = [], isLoading: inventoryLoading } = useSellerInventory(sellerId);

  const partners = isRetailer
    ? (distributorsData?.distributors ?? [])
    : (suppliersData?.suppliers ?? []);
  const partnersLoading = isRetailer ? distributorsLoading : suppliersLoading;
  const sellerLabel = isRetailer ? "Distributor partner" : "Supplier partner";
  const sellerLoading = isRetailer ? "Memuat distributor..." : "Memuat supplier...";
  const sellerEmpty = isRetailer
    ? "Belum ada distributor partner. Tambahkan partner di halaman Distributors terlebih dahulu."
    : "Belum ada supplier partner. Tambahkan partner di halaman Suppliers terlebih dahulu.";

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      setStep("form");
      setPendingPayload(null);
      setSellerId(prefill?.sellerId ?? "");
      setItems([
        prefill?.itemName
          ? { item_name: prefill.itemName, qty: prefill.qty ?? 1, qtyStr: String(prefill.qty ?? 1), unit: prefill.unit ?? "kg", price_per_unit: 0 }
          : emptyItem(),
      ]);
      setDeliveryAddress("");
      setNotes("");
      setError(null);
    }, 0);
    return () => clearTimeout(t);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function updateItem<K extends keyof OrderItem>(index: number, key: K, value: OrderItem[K]) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const totalAmount = items.reduce((sum, item) => sum + item.qty * item.price_per_unit, 0);

  const isFormValid =
    !!sellerId &&
    !!deliveryAddress.trim() &&
    items.length > 0 &&
    items.every((item) => item.item_name.trim() && item.qty > 0 && item.price_per_unit > 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const selectedPartner = partners.find((p) => {
      const id = "distributor_id" in p ? p.distributor_id : p.supplier_id;
      return id === sellerId;
    });
    const payload: CreateOrderPayload = {
      seller_id: sellerId,
      seller_type: prefill?.sellerType ?? sellerType,
      seller_name: selectedPartner?.name ?? "",
      buyer_id: user?.user_id ?? "",
      buyer_name: user?.business_name ?? user?.full_name ?? "",
      buyer_role: (role === "retailer" ? "retailer" : "distributor") as "distributor" | "retailer",
      items: items.map(({ item_name, qtyStr, unit, price_per_unit }) => ({
        item_name,
        qty: Math.max(1, parseInt(qtyStr || "1", 10) || 1),
        unit,
        price_per_unit,
      })),
      delivery_address: deliveryAddress.trim(),
      notes: notes.trim() || undefined,
    };
    setPendingPayload(payload);
    setStep("payment");
  }

  async function handleConfirmPayment() {
    if (!pendingPayload) return;
    setError(null);
    try {
      await create.mutateAsync(pendingPayload);
      setStep("success");
      setTimeout(() => onClose(), 1800);
    } catch {
      setError("Gagal membuat order. Coba lagi.");
      setStep("form");
    }
  }

  if (step === "success") {
    return (
      <Dialog open={open} onClose={onClose} title="Order Berhasil Dibuat">
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <div className="rounded-full bg-[#F0FDF4] p-4">
            <CheckCircle2 className="h-10 w-10 text-[#16A34A]" />
          </div>
          <div>
            <p className="text-base font-semibold text-[#0F172A]">Pesanan & payment proof berhasil</p>
            <p className="mt-1 text-sm text-[#64748B]">Transaksi dicatat on-chain via Solana Devnet.</p>
          </div>
        </div>
      </Dialog>
    );
  }

  if (step === "payment" && pendingPayload) {
    const total = pendingPayload.items.reduce(
      (s, it) => s + it.qty * it.price_per_unit,
      0,
    );
    return (
      <Dialog open={open} onClose={() => { setStep("form"); setError(null); }} title="Konfirmasi Payment">
        <div className="space-y-5">
          <div className="rounded-xl border border-[#DDD6FE] bg-[#F5F3FF] p-4 space-y-3">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-[#7C3AED]" />
              <span className="text-sm font-semibold text-[#7C3AED]">Simulasi Payment</span>
            </div>
            <p className="text-xs text-[#64748B]">
              Backend akan mencatat bukti pembayaran on-chain via Solana Memo Program (Devnet).
              Tidak ada transfer token nyata — ini simulasi escrow.
            </p>
            <div className="rounded-lg bg-white px-4 py-3 border border-[#E9D5FF]">
              <p className="text-xs text-[#64748B] uppercase tracking-[0.12em]">Total Amount</p>
              <p className="mt-1 text-2xl font-semibold text-[#0F172A]">
                {formatCurrency(total)}
              </p>
            </div>
            <div className="space-y-1.5 text-xs text-[#64748B]">
              <div className="flex justify-between">
                <span>Ke</span>
                <span className="font-medium text-[#0F172A]">{pendingPayload.seller_name || pendingPayload.seller_id.slice(0, 12) + "…"}</span>
              </div>
              <div className="flex justify-between">
                <span>Dari</span>
                <span className="font-medium text-[#0F172A]">{pendingPayload.buyer_name}</span>
              </div>
              <div className="flex justify-between">
                <span>Escrow status</span>
                <span className="font-medium text-[#F59E0B]">held (auto-release on delivery)</span>
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2.5 text-sm text-[#DC2626]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => { setStep("form"); setError(null); }} disabled={isLoading}>
              Kembali
            </Button>
            <Button type="button" onClick={handleConfirmPayment} disabled={isLoading}>
              {isLoading ? (
                <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Memproses…</>
              ) : (
                "Konfirmasi & Bayar"
              )}
            </Button>
          </div>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Buat Order Baru"
      description={`Pilih ${sellerLabel.toLowerCase()} dan isi detail item yang ingin dipesan.`}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Seller */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[#0F172A]">{sellerLabel}</label>
          <select
            className="h-11 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm text-[#0F172A] outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#BFDBFE] disabled:opacity-50"
            value={sellerId}
            onChange={(e) => { setSellerId(e.target.value); setItems([emptyItem()]); }}
            disabled={isLoading || partnersLoading}
            required
          >
            <option value="">
              {partnersLoading ? sellerLoading : `Pilih ${isRetailer ? "distributor" : "supplier"}`}
            </option>
            {partners.map((p) => {
              const id = "distributor_id" in p ? p.distributor_id : p.supplier_id;
              return (
                <option key={id} value={id}>
                  {p.name}
                </option>
              );
            })}
          </select>
          {!partnersLoading && partners.length === 0 && (
            <p className="text-xs text-[#64748B]">
              {sellerEmpty}
            </p>
          )}
        </div>

        {/* Items */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-[#0F172A]">Item yang dipesan</label>
            <Button
              type="button"
              variant="secondary"
              className="h-8 gap-1.5 px-3 text-xs"
              onClick={addItem}
              disabled={isLoading}
            >
              <Plus className="h-3 w-3" />
              Tambah item
            </Button>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => (
              <div
                key={index}
                className="rounded-xl border border-[#E2E8F0] bg-slate-50 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#64748B] uppercase tracking-[0.15em]">
                    Item {index + 1}
                  </span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      disabled={isLoading}
                      className="text-[#EF4444] hover:text-red-700 disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Item dropdown from seller inventory */}
                <div className="space-y-1">
                  <label className="text-xs text-[#64748B]">Nama item</label>
                  {!sellerId ? (
                    <p className="text-xs text-[#94A3B8]">Pilih supplier dulu untuk melihat item tersedia.</p>
                  ) : inventoryLoading ? (
                    <p className="text-xs text-[#94A3B8]">Memuat item supplier...</p>
                  ) : sellerInventory.length === 0 ? (
                    <p className="text-xs text-[#94A3B8]">Supplier belum punya item di inventory.</p>
                  ) : (
                    <select
                      className="h-11 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm text-[#0F172A] outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#BFDBFE] disabled:opacity-50"
                      value={item.item_name}
                      onChange={(e) => {
                        const selected = sellerInventory.find((inv) => inv.name === e.target.value);
                        if (selected) {
                          setItems((prev) =>
                            prev.map((it, i) =>
                              i === index
                                ? { ...it, item_name: selected.name, unit: selected.unit, price_per_unit: selected.price }
                                : it,
                            ),
                          );
                        } else {
                          updateItem(index, "item_name", e.target.value);
                        }
                      }}
                      disabled={isLoading}
                      required
                    >
                      <option value="">Pilih item</option>
                      {sellerInventory.map((inv) => (
                        <option key={inv.id} value={inv.name}>
                          {inv.name} ({inv.unit}) — stok: {inv.stock}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs text-[#64748B]">Qty</label>
                    <Input
                      inputMode="numeric"
                      value={item.qtyStr}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9]/g, "");
                        setItems((prev) =>
                          prev.map((it, i) =>
                            i === index ? { ...it, qtyStr: raw, qty: parseInt(raw || "1", 10) || 1 } : it,
                          ),
                        );
                      }}
                      onBlur={() =>
                        setItems((prev) =>
                          prev.map((it, i) =>
                            i === index
                              ? { ...it, qtyStr: String(Math.max(1, parseInt(it.qtyStr || "1", 10) || 1)) }
                              : it,
                          ),
                        )
                      }
                      onFocus={(e) => { if (e.target.value === "0" || e.target.value === "1") e.target.select(); }}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-[#64748B]">Unit</label>
                    <div className="flex h-11 items-center rounded-lg border border-[#E2E8F0] bg-slate-100 px-3 text-sm text-[#475569]">
                      {item.unit || "—"}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-[#64748B]">Harga/unit</label>
                    <div className="flex h-11 items-center rounded-lg border border-[#E2E8F0] bg-slate-100 px-3 text-sm font-medium text-[#0F172A]">
                      {item.price_per_unit > 0 ? formatCurrency(item.price_per_unit) : "—"}
                    </div>
                  </div>
                </div>

                <div className="text-right text-sm text-[#64748B]">
                  Subtotal:{" "}
                  <span className="font-semibold text-[#0F172A]">
                    {formatCurrency(item.qty * item.price_per_unit)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="flex justify-end rounded-xl bg-[#F0F9FF] px-4 py-3">
            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.18em] text-[#64748B]">Total Amount</p>
              <p className="mt-1 text-xl font-semibold text-[#0F172A]">
                {formatCurrency(totalAmount)}
              </p>
            </div>
          </div>
        </div>

        {/* Delivery Address */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[#0F172A]">Alamat pengiriman</label>
          <Input
            placeholder="Jl. Merdeka No.10, Jakarta Pusat"
            value={deliveryAddress}
            onChange={(e) => setDeliveryAddress(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[#0F172A]">
            Catatan{" "}
            <span className="font-normal text-[#94A3B8]">(opsional)</span>
          </label>
          <textarea
            className="min-h-[80px] w-full resize-none rounded-lg border border-[#E2E8F0] bg-white px-3 py-2.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#BFDBFE] disabled:opacity-50"
            placeholder="Tolong dikemas rapi, urgent, dll."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isLoading}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2.5 text-sm text-[#DC2626]">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
            Batal
          </Button>
          <Button type="submit" disabled={isLoading || !isFormValid}>
            {isLoading ? "Membuat order..." : "Buat Order"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}



