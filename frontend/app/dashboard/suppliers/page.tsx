"use client";

import { useCallback, useState } from "react";
import { Building2, Clock3, Loader2, Network, Package, Plus } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { SupplierCard } from "@/components/suppliers/supplier-card";
import { SupplierFilterBar } from "@/components/suppliers/supplier-filter-bar";
import { SuppliersEmptyState } from "@/components/suppliers/suppliers-empty-state";
import { SuppliersErrorState } from "@/components/suppliers/suppliers-error-state";
import { SuppliersLoadingState } from "@/components/suppliers/suppliers-loading-state";
import { SuppliersTrustPanel } from "@/components/suppliers/suppliers-trust-panel";
import { PartnershipRequestsPanel } from "@/components/suppliers/partnership-requests-panel";
import { RequestPartnershipDialog } from "@/components/suppliers/request-partnership-dialog";
import { SupplierStockDialog } from "@/components/suppliers/supplier-stock-dialog";
import { LegacyDialog as Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSuppliers, usePartnershipRequests, useDeleteSupplierPartnership, type Supplier } from "@/hooks/useSuppliers";
import { useAuthStore } from "@/store/useAuthStore";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

export default function SuppliersPage() {
  const role = useAuthStore((s) => s.user?.role) ?? "distributor";

  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [stockDialogOpen, setStockDialogOpen] = useState(false);
  const [stockSupplier, setStockSupplier] = useState<Supplier | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);

  const { data, isLoading, isError, refetch } = useSuppliers({ search, type });
  const { data: requestsData } = usePartnershipRequests("pending");
  const deletePartnership = useDeleteSupplierPartnership();

  const suppliers = data?.suppliers ?? [];
  const summary = data?.summary ?? { partner_count: 0, discover_count: 0, pending_requests: 0 };
  // Persistent: check which supplier_ids have pending requests
  const requestedIds = new Set(
    (requestsData?.requests ?? []).map((r: { supplier_id?: string }) => r.supplier_id ?? "")
  );

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
                ? "Manage supplier partners, evaluate supplier discover, and send new partnership requests."
                : "Monitor active partnerships and manage incoming partnership requests from distributors."}
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
                  isRequested={requestedIds.has(supplier.supplier_id)}
                  onRequestPartnership={role === "distributor" ? handleRequestPartnership : undefined}
                  onViewStock={(s) => { setStockSupplier(s); setStockDialogOpen(true); }}
                  onDeletePartnership={(s) => setDeleteTarget(s)}
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

      {/* View stock dialog */}
      {stockSupplier && (
        <SupplierStockDialog
          supplierId={stockSupplier.supplier_id}
          supplierName={stockSupplier.name}
          open={stockDialogOpen}
          onClose={() => { setStockDialogOpen(false); setStockSupplier(null); }}
        />
      )}

      {/* Delete partnership confirm dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deletePartnership.mutate(deleteTarget.supplier_id, {
            onSuccess: () => setDeleteTarget(null),
          });
        }}
        title={deleteTarget?.type === "partner" ? "End Partnership" : "Cancel Request"}
        description={
          deleteTarget?.type === "partner"
            ? `Are you sure you want to end the partnership with ${deleteTarget?.name}? This action cannot be undone.`
            : `Are you sure you want to cancel the partnership request with ${deleteTarget?.name}?`
        }
        confirmLabel={deleteTarget?.type === "partner" ? "End Partnership" : "Cancel Request"}
        isLoading={deletePartnership.isPending}
      />
    </main>
  );
}
