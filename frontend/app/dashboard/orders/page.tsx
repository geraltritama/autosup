"use client";

import { useState } from "react";
import { CheckCheck, Clock3, PackageOpen, Plus, Truck, Loader2, ShieldCheck, ExternalLink, CheckCircle, MapPin, Calendar } from "lucide-react";
import { useOrders, useOrderDetail, useUpdateOrderStatus, type OrderStatus } from "@/hooks/useOrders";
import { useBlockchainEscrow } from "@/hooks/usePartnerships";
import { OrderStatusUpdateDialog } from "@/components/orders/order-status-update-dialog";
import { LegacyDialog as Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/useAuthStore";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { OrderCard } from "@/components/orders/order-card";
import { OrderFormDialog } from "@/components/orders/order-form-dialog";
import { OrdersEmptyState } from "@/components/orders/orders-empty-state";
import { OrdersErrorState } from "@/components/orders/orders-error-state";
import { OrdersFilterBar } from "@/components/orders/orders-filter-bar";
import { OrdersLoadingState } from "@/components/orders/orders-loading-state";
import { OrdersTrustPanel } from "@/components/orders/orders-trust-panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function OrdersPage() {
  const role = useAuthStore((s) => s.user?.role);
  const [orderView, setOrderView] = useState<"outgoing" | "incoming">("outgoing");
  const isDistributor = role === "distributor";

  const orderRole = isDistributor
    ? (orderView === "outgoing" ? "buyer" : "seller")
    : (role === "retailer" ? "buyer" : "seller");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "">("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [trackingDialogOpen, setTrackingDialogOpen] = useState(false);
  const [selectedOrderForShipping, setSelectedOrderForShipping] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useOrders({
    role: orderRole,
    status: statusFilter || undefined,
  });

  const { mutate: updateStatus, isPending: isUpdating, variables: updatingVars } =
    useUpdateOrderStatus();
  const { data: orderDetail, isLoading: detailLoading } = useOrderDetail(detailOrderId);
  const { data: escrowChain } = useBlockchainEscrow(detailOrderId);

  const orders = data?.orders ?? [];
  const summary = data?.summary;

  const filtered = search.trim()
    ? orders.filter((o) => {
        const q = search.toLowerCase();
        return (
          o.order_number.toLowerCase().includes(q) ||
          o.buyer.name.toLowerCase().includes(q) ||
          o.seller.name.toLowerCase().includes(q)
        );
      })
    : orders;

  const showCreateOrder = role === "retailer" || (isDistributor && orderView === "outgoing");

  return (
    <main className="space-y-6 px-6 py-6 lg:px-8 lg:py-8">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-4 rounded-3xl border border-[#E2E8F0] bg-white px-6 py-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <Badge tone="info">Order operations</Badge>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-[#0F172A]">
              Orders
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-[#64748B]">
              {isDistributor
                ? orderView === "outgoing"
                  ? "Pantau order ke supplier dan buat order baru untuk restock inventory."
                  : "Kelola incoming order dari retailer dan perbarui status fulfillment."
                : role === "retailer"
                  ? "Pantau semua order ke distributor partner dan buat order baru langsung dari sini."
                  : "Kelola incoming order dari distributor dan perbarui status fulfillment."}
            </p>
          </div>
        </div>

        {showCreateOrder && (
          <div className="flex flex-wrap gap-3">
            <Button className="gap-2" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Create Order
            </Button>
          </div>
        )}
      </section>

      {/* ── Distributor Tab ─────────────────────────────────────────── */}
      {isDistributor && (
        <div className="flex gap-2 rounded-lg border border-[#E2E8F0] bg-slate-50 p-1">
          <button
            onClick={() => setOrderView("outgoing")}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              orderView === "outgoing"
                ? "bg-white text-[#0F172A] shadow-sm"
                : "text-[#64748B] hover:text-[#0F172A]"
            )}
          >
            Outgoing → Supplier
          </button>
          <button
            onClick={() => setOrderView("incoming")}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              orderView === "incoming"
                ? "bg-white text-[#0F172A] shadow-sm"
                : "text-[#64748B] hover:text-[#0F172A]"
            )}
          >
            Incoming ← Retailer
          </button>
        </div>
      )}

      {/* ── KPI Cards ──────────────────────────────────────────────── */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Active Orders"
          value={summary ? String(summary.active_orders) : "—"}
          meta="Currently in motion"
          tone="info"
          icon={PackageOpen}
        />
        <KpiCard
          label="Pending Orders"
          value={summary ? String(summary.pending_orders) : "—"}
          meta={role === "retailer"
            ? "Waiting distributor response"
            : (isDistributor && orderView === "incoming") || role === "supplier"
              ? "Waiting your response"
              : "Waiting supplier response"}
          tone="warning"
          icon={Clock3}
        />
        <KpiCard
          label="Completed Orders"
          value={summary ? String(summary.completed_orders) : "—"}
          meta="Selesai terkirim"
          tone="success"
          icon={CheckCheck}
        />
        <KpiCard
          label="Cancelled Orders"
          value={summary ? String(summary.cancelled_orders) : "—"}
          meta="Dibatalkan"
          tone="danger"
          icon={Truck}
        />
      </section>

      {/* ── Filter Bar ─────────────────────────────────────────────── */}
      <OrdersFilterBar
        search={search}
        onSearchChange={setSearch}
        status={statusFilter}
        onStatusChange={setStatusFilter}
      />

      {/* ── Main Content ───────────────────────────────────────────── */}
      <section className="grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
        <div className="grid gap-4">
          {isLoading && <OrdersLoadingState />}

          {isError && !isLoading && (
            <OrdersErrorState onRetry={() => refetch()} />
          )}

          {!isLoading && !isError && filtered.length === 0 && (
            <OrdersEmptyState
              showCreate={showCreateOrder}
              onCreateOrder={() => setCreateDialogOpen(true)}
            />
          )}

          {!isLoading &&
            !isError &&
            filtered.map((order) => (
              <OrderCard
                key={order.order_id}
                order={{
                  ...order,
                  estimated_delivery: formatDate(order.estimated_delivery),
                  updated_at: formatDate(order.updated_at),
                  created_at: formatDate(order.created_at),
                }}
                userRole={role}
                onViewDetail={(orderId) => setDetailOrderId(orderId)}
                onShip={(orderId) => {
                  setSelectedOrderForShipping(orderId);
                  setTrackingDialogOpen(true);
                }}
              />
            ))}
        </div>

        {/* Trust panel — selalu tampil di sidebar */}
        <div className="space-y-6">
          <OrdersTrustPanel />
        </div>
      </section>

      <OrderFormDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
      />

      {/* Tracking Dialog - untuk input shipping info */}
      {trackingDialogOpen && selectedOrderForShipping && (
        <OrderStatusUpdateDialog
          open={trackingDialogOpen}
          onClose={() => {
            setTrackingDialogOpen(false);
            setSelectedOrderForShipping(null);
          }}
          orderNumber={orders.find(o => o.order_id === selectedOrderForShipping)?.order_number ?? ""}
          newStatus="shipping"
          onUpdate={(shippingInfo) => {
            updateStatus({
              orderId: selectedOrderForShipping,
              status: "shipping",
              shipping_info: shippingInfo
                ? {
                    courier: shippingInfo.courier,
                    tracking_number: shippingInfo.tracking_number,
                    shipped_at: new Date().toISOString(),
                  }
                : undefined,
            });
            setTrackingDialogOpen(false);
            setSelectedOrderForShipping(null);
          }}
          isLoading={isUpdating}
        />
      )}

      {/* Order Detail Dialog */}
      <Dialog
        open={!!detailOrderId}
        onClose={() => setDetailOrderId(null)}
        title="Order Detail"
        description={orderDetail ? `${orderDetail.order_number} — ${orderDetail.buyer.name} (${orderDetail.buyer.role}) → ${orderDetail.seller.name} (${orderDetail.seller.role})` : "Memuat detail order..."}
      >
        {detailLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-[#94A3B8]" />
          </div>
        ) : !orderDetail ? (
          <p className="text-sm text-[#64748B]">Data tidak ditemukan.</p>
        ) : (
          <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-[#CBD5E1] scrollbar-track-transparent">
            {/* Items Ordered */}
            <div className="rounded-xl border border-[#E2E8F0] p-4 space-y-3">
              <p className="text-xs uppercase tracking-[0.15em] text-[#64748B]">Items Dipesan</p>
              <div className="space-y-2">
                {orderDetail.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-[#0F172A]">
                      {item.item_name} × {item.qty} {item.unit}
                    </span>
                    <span className="text-[#0F172A] font-medium">
                      Rp {(item.qty * item.price_per_unit).toLocaleString("id-ID")}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between border-t border-[#E2E8F0] pt-2 mt-2">
                <span className="text-sm font-semibold text-[#0F172A]">Total Amount</span>
                <span className="text-sm font-bold text-[#0F172A]">
                  Rp {orderDetail.total_amount.toLocaleString("id-ID")}
                </span>
              </div>
            </div>

            {/* Delivery Info */}
            <div className="rounded-xl bg-slate-50 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#64748B]" />
                <p className="text-xs uppercase tracking-[0.15em] text-[#64748B]">Alamat Pengiriman</p>
              </div>
              <p className="text-sm text-[#0F172A]">{orderDetail.delivery_address}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="h-3.5 w-3.5 text-[#64748B]" />
                  <p className="text-xs text-[#64748B]">Tanggal Order</p>
                </div>
                <p className="text-sm font-medium text-[#0F172A]">
                  {new Date(orderDetail.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Truck className="h-3.5 w-3.5 text-[#64748B]" />
                  <p className="text-xs text-[#64748B]">Estimasi Kirim</p>
                </div>
                <p className="text-sm font-medium text-[#0F172A]">
                  {new Date(orderDetail.estimated_delivery).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>
            </div>

            {/* Escrow Status */}
            <div className="flex items-center gap-3 rounded-xl border border-[#E2E8F0] p-4">
              <ShieldCheck className="h-5 w-5 shrink-0 text-[#3B82F6]" />
              <div className="flex-1">
                <p className="text-xs uppercase tracking-[0.15em] text-[#64748B]">Status Pembayaran (Escrow)</p>
                <Badge
                  className="mt-1"
                  tone={
                    orderDetail.escrow_status === "released"
                      ? "success"
                      : orderDetail.escrow_status === "refunded"
                      ? "warning"
                      : "info"
                  }
                >
                  {orderDetail.escrow_status === "held" ? "Ditahan" : orderDetail.escrow_status === "released" ? "Dibayar" : "Dikembalikan"}
                </Badge>
                {escrowChain && (
                  <div className="mt-3 space-y-2 rounded-lg border border-[#DDD6FE] bg-[#F5F3FF] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[#7C3AED]">{escrowChain.chain}</span>
                      <span className="text-xs text-[#6D28D9]">{escrowChain.program}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-[#64748B]">TX Hash</span>
                      <a
                        href={escrowChain.explorer_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 font-mono text-xs text-[#7C3AED] hover:underline"
                      >
                        {escrowChain.creation_tx.slice(0, 16)}… <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    {escrowChain.events.length > 1 && (
                      <div className="space-y-1 border-t border-[#DDD6FE] pt-2">
                        {escrowChain.events.slice(1).map((ev, i) => (
                          <div key={i} className="flex items-center justify-between gap-2">
                            <span className="text-xs capitalize text-[#64748B]">{ev.event.replace(/_/g, " ")}</span>
                            {ev.explorer_url && (
                              <a
                                href={ev.explorer_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 font-mono text-xs text-[#7C3AED] hover:underline"
                              >
                                {ev.tx.slice(0, 12)}… <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Shipping Info */}
            {orderDetail.shipping_info && (
              <div className="rounded-xl border border-[#E2E8F0] bg-slate-50 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-[#0284C7]" />
                  <span className="text-sm font-semibold text-[#0F172A]">Informasi Pengiriman</span>
                </div>
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Ekspedisi</span>
                    <span className="font-medium text-[#0F172A]">{orderDetail.shipping_info.courier}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">No. Resi</span>
                    <span className="font-mono text-[#0F172A]">{orderDetail.shipping_info.tracking_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Dikirim</span>
                    <span className="text-[#0F172A]">
                      {new Date(orderDetail.shipping_info.shipped_at).toLocaleDateString("id-ID", {
                        day: "numeric", month: "long", year: "numeric"
                      })}
                    </span>
                  </div>
                  {orderDetail.shipping_info.tracking_url && (
                    <a
                      href={orderDetail.shipping_info.tracking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs font-medium text-[#0284C7] hover:underline mt-1"
                    >
                      Lacak paket <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            {orderDetail.notes && (
              <div className="rounded-xl bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.15em] text-[#64748B]">Notes</p>
                <p className="mt-1 text-sm text-[#0F172A]">{orderDetail.notes}</p>
              </div>
            )}

            {/* Terima Barang Button - untuk buyer saat status shipped */}
            {orderDetail.buyer.role === role && orderDetail.status === "shipping" && orderDetail.escrow_status === "held" && (
              <Button
                className="w-full gap-2"
                onClick={() => {
                  updateStatus({ orderId: orderDetail.order_id, status: "delivered" });
                  setDetailOrderId(null);
                }}
              >
                <CheckCircle className="h-4 w-4" />
                Terima Barang
              </Button>
            )}

            {/* Status History Timeline */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-[#64748B]">Status History</p>
              <div className="space-y-0">
                {orderDetail.status_history.map((entry, i) => (
                  <div key={i} className="relative flex gap-4 pb-4 last:pb-0">
                    <div className="flex flex-col items-center">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#EFF6FF] text-[#3B82F6]">
                        <div className="h-2.5 w-2.5 rounded-full bg-[#3B82F6]" />
                      </div>
                      {i < orderDetail.status_history.length - 1 && (
                        <div className="mt-1 w-px flex-1 bg-[#E2E8F0]" />
                      )}
                    </div>
                    <div className="pb-1 pt-0.5">
                      <p className="text-sm font-medium capitalize text-[#0F172A]">{entry.status}</p>
                      <p className="text-xs text-[#94A3B8]">
                        {new Intl.DateTimeFormat("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(entry.changed_at))}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Dialog>
    </main>
  );
}