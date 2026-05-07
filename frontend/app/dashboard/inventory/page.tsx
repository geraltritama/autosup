"use client";

import { useCallback, useState } from "react";
import { ArchiveX, Boxes, CircleAlert, Download, Plus } from "lucide-react";
import { InventoryEmptyState } from "@/components/inventory/inventory-empty-state";
import { InventoryErrorState } from "@/components/inventory/inventory-error-state";
import { InventoryFilterBar } from "@/components/inventory/inventory-filter-bar";
import { InventoryLoadingState } from "@/components/inventory/inventory-loading-state";
import { InventoryTable } from "@/components/inventory/inventory-table";
import { ItemFormDialog } from "@/components/inventory/item-form-dialog";
import { DeleteConfirmDialog } from "@/components/inventory/delete-confirm-dialog";
import { RestockPanel } from "@/components/inventory/restock-panel";
import { OrderFormDialog } from "@/components/orders/order-form-dialog";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/useAuthStore";
import {
  useInventory,
  useRestockRecommendation,
  type InventoryItem,
  type RestockRecommendation,
} from "@/hooks/useInventory";

const ROLE_COPY = {
  supplier: {
    badge: "Supplier · Inventory Produk",
    title: "Inventory Produk",
    description: "Kelola produk yang Anda jual ke distributor. Set harga jual, threshold minimum, dan status stok.",
    kpi1Label: "Total Produk",
    kpi1Meta: "Semua SKU yang Anda jual",
    showPrice: true,
    priceLabel: "Harga jual ke distributor (IDR)",
  },
  distributor: {
    badge: "Distributor · Stok Distribusi",
    title: "Stok Distribusi",
    description: "Kelola stok produk yang Anda distribusikan ke retailer. Pantau ketersediaan dan threshold restock.",
    kpi1Label: "Total SKU",
    kpi1Meta: "Semua produk distribusi",
    showPrice: true,
    priceLabel: "Harga jual ke retailer (IDR)",
  },
  retailer: {
    badge: "Retailer · Stok Operasional",
    title: "Stok Operasional",
    description: "Pantau stok operasional toko Anda. Monitor ketersediaan dan buat order restock sebelum kehabisan.",
    kpi1Label: "Total Item",
    kpi1Meta: "Semua stok operasional",
    showPrice: false,
    priceLabel: "",
  },
} as const;

type DialogState =
  | { type: "closed" }
  | { type: "add" }
  | { type: "edit"; item: InventoryItem }
  | { type: "delete"; item: InventoryItem };

export default function InventoryPage() {
  const role = useAuthStore((s) => s.user?.role) ?? "distributor";
  const copy = ROLE_COPY[role];

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [dialog, setDialog] = useState<DialogState>({ type: "closed" });
  const [restock, setRestock] = useState<RestockRecommendation | null>(null);
  const [orderOpen, setOrderOpen] = useState(false);
  const [orderPrefill, setOrderPrefill] = useState<{ sellerId?: string; sellerType?: "supplier" | "distributor"; itemName?: string; qty?: number; unit?: string } | undefined>();

  const { data, isLoading, isError, refetch } = useInventory({ search, category, status });
  const restockMutation = useRestockRecommendation();

  const openAdd = useCallback(() => setDialog({ type: "add" }), []);
  const openEdit = useCallback((item: InventoryItem) => setDialog({ type: "edit", item }), []);
  const openDelete = useCallback((item: InventoryItem) => setDialog({ type: "delete", item }), []);
  const closeDialog = useCallback(() => setDialog({ type: "closed" }), []);

  async function handleRestock(item: InventoryItem) {
    setRestock(null);
    try {
      const rec = await restockMutation.mutateAsync(item.id);
      setRestock(rec);
    } catch {
      /* silently fail — user can retry */
    }
  }

  function handleCreateOrder(rec: RestockRecommendation) {
    setOrderPrefill({
      sellerId: rec.suggested_seller?.seller_id,
      sellerType: rec.suggested_seller?.seller_type,
      itemName: rec.item_name,
      qty: rec.suggested_qty,
      unit: rec.suggested_unit,
    });
    setRestock(null);
    setOrderOpen(true);
  }

  const summary = data?.summary ?? { total_items: 0, low_stock_count: 0, out_of_stock_count: 0 };
  const items = data?.items ?? [];

  return (
    <main className="space-y-6 px-6 py-6 lg:px-8 lg:py-8">
      {/* Header */}
      <section className="flex flex-col gap-4 rounded-3xl border border-[#E2E8F0] bg-white px-6 py-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <Badge tone="info">{copy.badge}</Badge>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-[#0F172A]">{copy.title}</h1>
            <p className="max-w-3xl text-sm leading-7 text-[#64748B]">
              {copy.description}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button className="gap-2" onClick={openAdd}>
            <Plus className="h-4 w-4" />
            Add Item
          </Button>
        </div>
      </section>

      {/* KPI cards */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          label={copy.kpi1Label}
          value={String(summary.total_items)}
          meta={copy.kpi1Meta}
          tone="info"
          icon={Boxes}
        />
        <KpiCard
          label="Low Stock"
          value={String(summary.low_stock_count)}
          meta="Needs attention soon"
          tone="warning"
          icon={CircleAlert}
        />
        <KpiCard
          label="Out of Stock"
          value={String(summary.out_of_stock_count)}
          meta="Immediate action needed"
          tone="danger"
          icon={ArchiveX}
        />
      </section>

      {/* AI Restock panel (shown after recommendation is fetched) */}
      {restock && (
        <RestockPanel
          recommendation={restock}
          onClose={() => setRestock(null)}
          onCreateOrder={handleCreateOrder}
        />
      )}

      {/* Loading restock */}
      {restockMutation.isPending && (
        <div className="rounded-2xl border border-blue-100 bg-[#EFF6FF] px-5 py-4 text-sm text-[#2563EB]">
          Mengambil rekomendasi restock dari AI...
        </div>
      )}

      {/* Filter bar */}
      <InventoryFilterBar
        search={search}
        category={category}
        status={status}
        onSearchChange={setSearch}
        onCategoryChange={setCategory}
        onStatusChange={setStatus}
        onReset={() => { setSearch(""); setCategory(""); setStatus(""); }}
      />

      {/* Main content states */}
      {isLoading && <InventoryLoadingState />}

      {isError && !isLoading && (
        <InventoryErrorState onRetry={() => refetch()} />
      )}

      {!isLoading && !isError && items.length === 0 && (
        <InventoryEmptyState onAdd={openAdd} />
      )}

      {!isLoading && !isError && items.length > 0 && (
        <InventoryTable
          items={items}
          onEdit={openEdit}
          onDelete={openDelete}
          onRestock={handleRestock}
          showPrice={copy.showPrice}
        />
      )}

      {/* Dialogs */}
      <ItemFormDialog
        open={dialog.type === "add" || dialog.type === "edit"}
        onClose={closeDialog}
        editItem={dialog.type === "edit" ? dialog.item : null}
        showPrice={copy.showPrice}
        priceLabel={copy.priceLabel}
      />

      <DeleteConfirmDialog
        open={dialog.type === "delete"}
        onClose={closeDialog}
        item={dialog.type === "delete" ? dialog.item : null}
      />

      <OrderFormDialog
        open={orderOpen}
        onClose={() => setOrderOpen(false)}
        prefill={orderPrefill}
      />
    </main>
  );
}
