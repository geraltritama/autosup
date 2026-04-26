import { Building2, Clock3, Network, Plus } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { SupplierCard, type SupplierCardData } from "@/components/suppliers/supplier-card";
import { SuppliersEmptyState } from "@/components/suppliers/suppliers-empty-state";
import { SuppliersErrorState } from "@/components/suppliers/suppliers-error-state";
import { SupplierFilterBar } from "@/components/suppliers/supplier-filter-bar";
import { SuppliersLoadingState } from "@/components/suppliers/suppliers-loading-state";
import { SuppliersTrustPanel } from "@/components/suppliers/suppliers-trust-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const suppliers: SupplierCardData[] = [
  {
    supplier_id: "supplier-uuid-001",
    name: "CV Maju Bersama",
    category: "bahan_makanan",
    type: "partner",
    reputation_score: 92,
    total_transactions: 48,
    on_time_delivery_rate: 95,
    wallet_address: "So1ana...xyz",
    is_active: true,
  },
  {
    supplier_id: "supplier-uuid-002",
    name: "PT Sejahtera Abadi",
    category: "packaging",
    type: "discover",
    reputation_score: 88,
    total_transactions: 31,
    on_time_delivery_rate: 91,
    wallet_address: "So1ana...ab2",
    is_active: true,
  },
  {
    supplier_id: "supplier-uuid-003",
    name: "Nusantara Supply Co.",
    category: "bahan_produksi",
    type: "partner",
    reputation_score: 90,
    total_transactions: 63,
    on_time_delivery_rate: 93,
    wallet_address: "So1ana...pn7",
    is_active: true,
  },
  {
    supplier_id: "supplier-uuid-004",
    name: "Prima Kitchen Goods",
    category: "bahan_makanan",
    type: "discover",
    reputation_score: 79,
    total_transactions: 12,
    on_time_delivery_rate: 84,
    wallet_address: "So1ana...zt4",
    is_active: false,
  },
];

const summary = {
  partnerSuppliers: 8,
  discoverSuppliers: 15,
  pendingRequests: 3,
};

export default function SuppliersPage() {
  return (
    <main className="space-y-6 px-6 py-6 lg:px-8 lg:py-8">
      <section className="flex flex-col gap-4 rounded-3xl border border-[#E2E8F0] bg-white px-6 py-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <Badge tone="info">Supplier management</Badge>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-[#0F172A]">
              Suppliers
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-[#64748B]">
              Kelola supplier partner, evaluasi supplier discover, dan siapkan workflow partnership dengan trust layer yang tetap sederhana di sisi UI.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary">View Requests</Button>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Explore Suppliers
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          label="Partner Suppliers"
          value={String(summary.partnerSuppliers)}
          meta="Active trusted relationships"
          tone="success"
          icon={Building2}
        />
        <KpiCard
          label="Discover Suppliers"
          value={String(summary.discoverSuppliers)}
          meta="Available for evaluation"
          tone="info"
          icon={Network}
        />
        <KpiCard
          label="Pending Requests"
          value={String(summary.pendingRequests)}
          meta="Awaiting partnership response"
          tone="warning"
          icon={Clock3}
        />
      </section>

      <SupplierFilterBar />

      <section className="grid gap-6 xl:grid-cols-[1.5fr_0.85fr]">
        <div className="grid gap-4">
          {suppliers.map((supplier) => (
            <SupplierCard key={supplier.supplier_id} supplier={supplier} />
          ))}
        </div>

        <div className="space-y-6">
          <SuppliersTrustPanel />
          <SuppliersErrorState />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SuppliersEmptyState />
        <SuppliersLoadingState />
      </section>
    </main>
  );
}
