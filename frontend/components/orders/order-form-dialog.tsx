"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, CreditCard, Loader2, Plus, Trash2, Wallet, Building2 } from "lucide-react";
import { LegacyDialog as Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateOrder, type CreateOrderPayload } from "@/hooks/useOrders";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useDistributors } from "@/hooks/useDistributors";
import { useSellerInventory } from "@/hooks/useInventory";
import { useAuthStore } from "@/store/useAuthStore";
import { api, type ApiResponse } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

type PaymentMethod = { id: string; name: string; type: string; icon: string };

const PAYMENT_LOGOS: Record<string, string> = {
  gopay: "/images/payments/gopay.svg",
  ovo: "/images/payments/ovo.svg",
  dana: "/images/payments/dana.svg",
  shopeepay: "/images/payments/shopeepay.svg",
  bca: "/images/payments/bca.svg",
  mandiri: "/images/payments/mandiri.svg",
  bri: "/images/payments/bri.svg",
  bni: "/images/payments/bni.svg",
  qris: "/images/payments/qris.svg",
};

function usePaymentMethods() {
  return useQuery({
    queryKey: ["payment-methods"],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<{ methods: PaymentMethod[] }>>("/payments/methods");
      return data.data.methods;
    },
    staleTime: 5 * 60 * 1000,
  });
}


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
  return new Intl.NumberFormat("en-US", {
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
  const [selectedMethod, setSelectedMethod] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const { data: paymentMethods = [], isLoading: methodsLoading } = usePaymentMethods();

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
  const sellerLoading = isRetailer ? "Loading distributors..." : "Loading suppliers...";
  const sellerEmpty = isRetailer
    ? "No distributor partners yet. Add partners on the Distributors page first."
    : "No supplier partners yet. Add partners on the Suppliers page first.";

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
      setSelectedMethod("");
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
    if (!pendingPayload || !selectedMethod) return;
    setError(null);
    setCheckoutLoading(true);
    try {
      const orderRes = await create.mutateAsync(pendingPayload);
      await api.post(`/payments/checkout/${orderRes.order_id}`, { payment_method: selectedMethod });
      setStep("success");
      setTimeout(() => onClose(), 1800);
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Failed to create order. Please try again.";
      setError(msg);
      setStep("form");
    } finally {
      setCheckoutLoading(false);
    }
  }

  if (step === "success") {
    return (
      <Dialog open={open} onClose={onClose} title="Order Successfully Created">
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <div className="rounded-full bg-[#F0FDF4] p-4">
            <CheckCircle2 className="h-10 w-10 text-[#16A34A]" />
          </div>
          <div>
            <p className="text-base font-semibold text-[#0F172A]">Order & payment proof submitted</p>
            <p className="mt-1 text-sm text-[#64748B]">Transaction recorded on-chain via Solana Devnet.</p>
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
    const ewallets = paymentMethods.filter((m) => m.type === "e-wallet");
    const banks = paymentMethods.filter((m) => m.type === "bank_transfer");
    const qrisMethods = paymentMethods.filter((m) => m.type === "qris");
    const busy = isLoading || checkoutLoading;
    return (
      <Dialog open={open} onClose={() => { setStep("form"); setError(null); }} title="Select Payment Method">
        <div className="space-y-5">
          {/* Total */}
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
            <p className="text-xs text-[#64748B] uppercase tracking-[0.12em]">Total Amount</p>
            <p className="mt-1 text-2xl font-semibold text-[#0F172A]">{formatCurrency(total)}</p>
          </div>

          {methodsLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-[#94A3B8]" /></div>
          ) : (
            <div className="space-y-4">
              {/* Credit Line option */}
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-[#64748B]">
                  <CreditCard className="h-3.5 w-3.5" /> Credit Line
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedMethod("credit_line")}
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                    selectedMethod === "credit_line"
                      ? "border-[#3B82F6] bg-[#EFF6FF] ring-2 ring-[#BFDBFE]"
                      : "border-[#E2E8F0] bg-white hover:border-[#94A3B8]"
                  }`}
                >
                  <CreditCard className="h-5 w-5 text-[#7C3AED]" />
                  <div>
                    <p className="text-sm font-medium text-[#0F172A]">Pay with Credit Line</p>
                    <p className="text-[10px] text-[#64748B]">Deduct from your available credit balance</p>
                  </div>
                </button>
              </div>

              {/* E-Wallet */}
              {ewallets.length > 0 && (
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-[#64748B]">
                    <Wallet className="h-3.5 w-3.5" /> E-Wallet
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {ewallets.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedMethod(m.id)}
                        className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                          selectedMethod === m.id
                            ? "border-[#3B82F6] bg-[#EFF6FF] ring-2 ring-[#BFDBFE]"
                            : "border-[#E2E8F0] bg-white hover:border-[#94A3B8]"
                        }`}
                      >
                        {PAYMENT_LOGOS[m.id] && <img src={PAYMENT_LOGOS[m.id]} alt={m.name} className="h-6 w-auto max-w-[32px] object-contain" />}
                        <span className="text-sm font-medium text-[#0F172A]">{m.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Bank Transfer */}
              {banks.length > 0 && (
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-[#64748B]">
                    <Building2 className="h-3.5 w-3.5" /> Bank Transfer
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {banks.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedMethod(m.id)}
                        className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                          selectedMethod === m.id
                            ? "border-[#3B82F6] bg-[#EFF6FF] ring-2 ring-[#BFDBFE]"
                            : "border-[#E2E8F0] bg-white hover:border-[#94A3B8]"
                        }`}
                      >
                        {PAYMENT_LOGOS[m.id] && <img src={PAYMENT_LOGOS[m.id]} alt={m.name} className="h-6 w-auto max-w-[32px] object-contain" />}
                        <span className="text-sm font-medium text-[#0F172A]">{m.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* QRIS */}
              {qrisMethods.length > 0 && (
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-[#64748B]">
                    <CreditCard className="h-3.5 w-3.5" /> QRIS
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedMethod("qris")}
                    className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                      selectedMethod === "qris"
                        ? "border-[#3B82F6] bg-[#EFF6FF] ring-2 ring-[#BFDBFE]"
                        : "border-[#E2E8F0] bg-white hover:border-[#94A3B8]"
                    }`}
                  >
                    <img src="/images/payments/qris.svg" alt="QRIS" className="h-6 w-auto max-w-[40px] object-contain" />
                    <span className="text-sm font-medium text-[#0F172A]">QRIS (All E-Wallet & Bank)</span>
                  </button>
                  {selectedMethod === "qris" && (
                    <div className="flex flex-col items-center gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                      <svg viewBox="0 0 200 200" className="h-40 w-40">
                        <rect width="200" height="200" fill="#fff" />
                        <rect x="20" y="20" width="30" height="30" fill="#000" />
                        <rect x="150" y="20" width="30" height="30" fill="#000" />
                        <rect x="20" y="150" width="30" height="30" fill="#000" />
                        <rect x="25" y="25" width="20" height="20" fill="#fff" />
                        <rect x="155" y="25" width="20" height="20" fill="#fff" />
                        <rect x="25" y="155" width="20" height="20" fill="#fff" />
                        <rect x="30" y="30" width="10" height="10" fill="#000" />
                        <rect x="160" y="30" width="10" height="10" fill="#000" />
                        <rect x="30" y="160" width="10" height="10" fill="#000" />
                        <rect x="60" y="20" width="8" height="8" fill="#000" />
                        <rect x="76" y="20" width="8" height="8" fill="#000" />
                        <rect x="92" y="20" width="8" height="8" fill="#000" />
                        <rect x="108" y="28" width="8" height="8" fill="#000" />
                        <rect x="124" y="20" width="8" height="8" fill="#000" />
                        <rect x="60" y="36" width="8" height="8" fill="#000" />
                        <rect x="84" y="36" width="8" height="8" fill="#000" />
                        <rect x="108" y="36" width="8" height="8" fill="#000" />
                        <rect x="132" y="36" width="8" height="8" fill="#000" />
                        <rect x="60" y="60" width="8" height="8" fill="#000" />
                        <rect x="76" y="68" width="8" height="8" fill="#000" />
                        <rect x="92" y="60" width="8" height="8" fill="#000" />
                        <rect x="108" y="68" width="8" height="8" fill="#000" />
                        <rect x="124" y="60" width="8" height="8" fill="#000" />
                        <rect x="140" y="68" width="8" height="8" fill="#000" />
                        <rect x="156" y="60" width="8" height="8" fill="#000" />
                        <rect x="172" y="68" width="8" height="8" fill="#000" />
                        <rect x="20" y="60" width="8" height="8" fill="#000" />
                        <rect x="36" y="68" width="8" height="8" fill="#000" />
                        <rect x="20" y="76" width="8" height="8" fill="#000" />
                        <rect x="60" y="76" width="8" height="8" fill="#000" />
                        <rect x="84" y="84" width="8" height="8" fill="#000" />
                        <rect x="100" y="76" width="8" height="8" fill="#000" />
                        <rect x="116" y="84" width="8" height="8" fill="#000" />
                        <rect x="140" y="76" width="8" height="8" fill="#000" />
                        <rect x="60" y="92" width="8" height="8" fill="#000" />
                        <rect x="76" y="100" width="8" height="8" fill="#000" />
                        <rect x="92" y="92" width="8" height="8" fill="#000" />
                        <rect x="116" y="100" width="8" height="8" fill="#000" />
                        <rect x="140" y="92" width="8" height="8" fill="#000" />
                        <rect x="156" y="100" width="8" height="8" fill="#000" />
                        <rect x="172" y="92" width="8" height="8" fill="#000" />
                        <rect x="20" y="92" width="8" height="8" fill="#000" />
                        <rect x="36" y="100" width="8" height="8" fill="#000" />
                        <rect x="20" y="108" width="8" height="8" fill="#000" />
                        <rect x="60" y="116" width="8" height="8" fill="#000" />
                        <rect x="76" y="124" width="8" height="8" fill="#000" />
                        <rect x="100" y="116" width="8" height="8" fill="#000" />
                        <rect x="124" y="124" width="8" height="8" fill="#000" />
                        <rect x="148" y="116" width="8" height="8" fill="#000" />
                        <rect x="172" y="124" width="8" height="8" fill="#000" />
                        <rect x="60" y="140" width="8" height="8" fill="#000" />
                        <rect x="84" y="148" width="8" height="8" fill="#000" />
                        <rect x="108" y="140" width="8" height="8" fill="#000" />
                        <rect x="132" y="148" width="8" height="8" fill="#000" />
                        <rect x="156" y="140" width="8" height="8" fill="#000" />
                        <rect x="172" y="148" width="8" height="8" fill="#000" />
                        <rect x="60" y="164" width="8" height="8" fill="#000" />
                        <rect x="76" y="172" width="8" height="8" fill="#000" />
                        <rect x="100" y="164" width="8" height="8" fill="#000" />
                        <rect x="124" y="172" width="8" height="8" fill="#000" />
                        <rect x="148" y="164" width="8" height="8" fill="#000" />
                        <rect x="172" y="172" width="8" height="8" fill="#000" />
                        <rect x="155" y="155" width="20" height="20" fill="#000" />
                        <rect x="160" y="160" width="10" height="10" fill="#fff" />
                      </svg>
                      <p className="text-xs text-[#64748B] text-center">Scan QR code with any QRIS-supported app</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Escrow info */}
          <div className="rounded-xl border border-[#DDD6FE] bg-[#F5F3FF] px-4 py-3">
            <p className="text-xs text-[#64748B]">
              Payment secured via on-chain escrow (Solana Devnet). Funds auto-release on delivery confirmation.
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2.5 text-sm text-[#DC2626]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => { setStep("form"); setError(null); setSelectedMethod(""); }} disabled={busy}>
              Back
            </Button>
            <Button type="button" onClick={handleConfirmPayment} disabled={busy || !selectedMethod}>
              {busy ? (
                <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Processing…</>
              ) : (
                "Confirm & Pay"
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
      title="Create New Order"
      description={`Select ${sellerLabel.toLowerCase()} and enter the item details you want to order.`}
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
              {partnersLoading ? sellerLoading : `Select ${isRetailer ? "distributor" : "supplier"}`}
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
            <label className="text-sm font-medium text-[#0F172A]">Items ordered</label>
            <Button
              type="button"
              variant="secondary"
              className="h-8 gap-1.5 px-3 text-xs"
              onClick={addItem}
              disabled={isLoading}
            >
              <Plus className="h-3 w-3" />
              Add item
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
                  <label className="text-xs text-[#64748B]">Item name</label>
                  {!sellerId ? (
                    <p className="text-xs text-[#94A3B8]">Select a supplier first to see available items.</p>
                  ) : inventoryLoading ? (
                    <p className="text-xs text-[#94A3B8]">Loading supplier items...</p>
                  ) : sellerInventory.length === 0 ? (
                    <p className="text-xs text-[#94A3B8]">Supplier has no items in inventory.</p>
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
                      <option value="">Select item</option>
                      {sellerInventory.map((inv) => (
                        <option key={inv.id} value={inv.name}>
                          {inv.name} ({inv.unit}) — stock: {inv.stock}
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
                    <label className="text-xs text-[#64748B]">Price/unit</label>
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
          <label className="text-sm font-medium text-[#0F172A]">Delivery address</label>
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
            Notes{" "}
            <span className="font-normal text-[#94A3B8]">(optional)</span>
          </label>
          <textarea
            className="min-h-[80px] w-full resize-none rounded-lg border border-[#E2E8F0] bg-white px-3 py-2.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#BFDBFE] disabled:opacity-50"
            placeholder="Please pack neatly, urgent, etc."
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
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading || !isFormValid}>
            {isLoading ? "Creating order..." : "Create Order"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}



