"use client";

import { useCallback, useState } from "react";
import { Building2, Clock3, Network, Plus } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { SupplierCard } from "@/components/suppliers/supplier-card";
import { SupplierFilterBar } from "@/components/suppliers/supplier-filter-bar";
import { SuppliersEmptyState } from "@/components/suppliers/suppliers-empty-state";
import { SuppliersErrorState } from "@/components/suppliers/suppliers-error-state";
import { SuppliersLoadingState } from "@/components/suppliers/suppliers-loading-state";
import { SuppliersTrustPanel } from "@/components/suppliers/suppliers-trust-panel";
import { PartnershipRequestsPanel } from "@/components/suppliers/partnership-requests-panel";
import { RequestPartnershipDialog } from "@/components/suppliers/request-partnership-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSuppliers, type Supplier } from "@/hooks/useSuppliers";
import { useAuthStore } from "@/store/useAuthStore";

export default function SuppliersPage() {
  const role = useAuthStore((s) => s.user?.role) ?? "distributor";

  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useSuppliers({ search, type });

  const suppliers = data?.suppliers ?? [];
  const summary = data?.summary ?? { partner_count: 0, discover_count: 0, pending_requests: 0 };

  const handleRequestPartnership = useCallback((supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setDialogOpen(true);
  }, []);

  const handleReset = useCallback(() => {
    setSearch("");
    setType("");
  }, []);

  return (
    <main className="space-y-6 px-6 py-6 lg:px-8 lg:py-8">
      {/* Header */}
      <section className="flex flex-col gap-4 rounded-3xl border border-[#E2E8F0] bg-white px-6 py-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <Badge tone="info">Supplier management</Badge>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-[#0F172A]">Suppliers</h1>
            <p className="max-w-3xl text-sm leading-7 text-[#64748B]">
              {role === "distributor"
                ? "Kelola supplier partner, evaluasi supplier discover, dan kirim permintaan kemitraan baru."
                : "Pantau kemitraan aktif dan kelola permintaan partnership masuk dari distributor."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {role === "distributor" && (
            <Button className="gap-2" onClick={() => setType("discover")}>
              <Plus className="h-4 w-4" />
              Explore Suppliers
            </Button>
          )}
        </div>
      </section>

      {/* KPI cards */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          label="Partner Suppliers"
          value={String(summary.partner_count)}
          meta="Active trusted relationships"
          tone="success"
          icon={Building2}
        />
        <KpiCard
          label="Discover Suppliers"
          value={String(summary.discover_count)}
          meta="Available for evaluation"
          tone="info"
          icon={Network}
        />
        <KpiCard
          label="Pending Requests"
          value={String(summary.pending_requests)}
          meta={role === "supplier" ? "Awaiting your response" : "Awaiting supplier response"}
          tone="warning"
          icon={Clock3}
        />
      </section>

      {/* Filter bar */}
      <SupplierFilterBar
        search={search}
        type={type}
        onSearchChange={setSearch}
        onTypeChange={setType}
        onReset={handleReset}
      />

      {/* Main content */}
      <section className="grid gap-6 xl:grid-cols-[1.5fr_0.85fr]">
        <div>
          {isLoading && <SuppliersLoadingState />}

          {isError && !isLoading && (
            <SuppliersErrorState onRetry={() => refetch()} />
          )}

          {!isLoading && !isError && suppliers.length === 0 && (
            <SuppliersEmptyState onExplore={() => { setSearch(""); setType("discover"); }} />
          )}

          {!isLoading && !isError && suppliers.length > 0 && (
            <div className="grid gap-4">
              {suppliers.map((supplier) => (
                <SupplierCard
                  key={supplier.supplier_id}
                  supplier={supplier}
                  onRequestPartnership={role === "distributor" ? handleRequestPartnership : undefined}
                />
              ))}
            </div>
          )}
        </div>

        {/* Side panel — role-aware */}
        <div className="space-y-6">
          {role === "supplier" ? (
            <PartnershipRequestsPanel />
          ) : (
            <SuppliersTrustPanel />
          )}
        </div>
      </section>

      {/* Request partnership dialog — distributor only */}
      {role === "distributor" && (
        <RequestPartnershipDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          supplier={selectedSupplier}
        />
      )}
    </main>
  );
}
