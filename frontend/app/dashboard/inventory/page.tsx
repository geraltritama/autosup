import { ArchiveX, Boxes, CircleAlert, Download, Plus } from "lucide-react";
import { InventoryEmptyState } from "@/components/inventory/inventory-empty-state";
import { InventoryErrorState } from "@/components/inventory/inventory-error-state";
import { InventoryFilterBar } from "@/components/inventory/inventory-filter-bar";
import { InventoryLoadingState } from "@/components/inventory/inventory-loading-state";
import { InventoryTable, type InventoryItem } from "@/components/inventory/inventory-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/dashboard/kpi-card";

const inventoryItems: InventoryItem[] = [
  {
    id: "item-uuid-001",
    name: "Tepung Terigu",
    category: "bahan_baku",
    stock: 15,
    min_stock: 50,
    unit: "kg",
    status: "low_stock",
    last_updated: "10 Jul 2025, 08:30",
  },
  {
    id: "item-uuid-002",
    name: "Gula Pasir",
    category: "bahan_baku",
    stock: 200,
    min_stock: 100,
    unit: "kg",
    status: "in_stock",
    last_updated: "09 Jul 2025, 14:00",
  },
  {
    id: "item-uuid-003",
    name: "Minyak Goreng",
    category: "bahan_baku",
    stock: 0,
    min_stock: 30,
    unit: "liter",
    status: "out_of_stock",
    last_updated: "10 Jul 2025, 09:10",
  },
  {
    id: "item-uuid-004",
    name: "Cup Packaging 16oz",
    category: "packaging",
    stock: 560,
    min_stock: 200,
    unit: "pcs",
    status: "in_stock",
    last_updated: "10 Jul 2025, 07:45",
  },
  {
    id: "item-uuid-005",
    name: "Brown Sugar Syrup",
    category: "produk_jadi",
    stock: 22,
    min_stock: 40,
    unit: "bottle",
    status: "low_stock",
    last_updated: "10 Jul 2025, 06:55",
  },
];

const summary = {
  total_items: 24,
  low_stock_count: 3,
  out_of_stock_count: 1,
};

export default function InventoryPage() {
  return (
    <main className="space-y-6 px-6 py-6 lg:px-8 lg:py-8">
      <section className="flex flex-col gap-4 rounded-3xl border border-[#E2E8F0] bg-white px-6 py-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <Badge tone="info">Inventory management</Badge>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-[#0F172A]">
              Inventory
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-[#64748B]">
              Pantau stok, threshold minimum, dan readiness operasional dari satu halaman kerja yang rapi dan siap disambungkan ke API nantinya.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Item
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          label="Total Items"
          value={String(summary.total_items)}
          meta="All tracked SKUs"
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

      <InventoryFilterBar />

      <InventoryTable items={inventoryItems} />

      <section className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-1">
          <InventoryEmptyState />
        </div>
        <div className="xl:col-span-2 space-y-6">
          <InventoryErrorState />
          <InventoryLoadingState />
        </div>
      </section>
    </main>
  );
}
