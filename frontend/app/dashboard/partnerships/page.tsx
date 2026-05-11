"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Gem, Handshake, FileClock, Percent, ShieldCheck, TrendingUp } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { InsightCard } from "@/components/dashboard/insight-card";
import { SupplierCard } from "@/components/suppliers/supplier-card";
import { RetailerCard } from "@/components/retailers/retailer-card";
import { DistributorCard } from "@/components/distributors/distributor-card";
import { DistributorStockDialog } from "@/components/distributors/distributor-stock-dialog";
import { SupplierStockDialog } from "@/components/suppliers/supplier-stock-dialog";
import { DistributorDetailDialog } from "@/components/distributors/distributor-detail-dialog";
import { SuppliersTrustPanel } from "@/components/suppliers/suppliers-trust-panel";
import { PageErrorState } from "@/components/dashboard/page-error-state";
import { Badge } from "@/components/ui/badge";
import { usePartnershipsSummary, usePartnershipNFT, useDistributorPartnershipNFT, useRetailerPartnershipNFT, type PartnershipSummary } from "@/hooks/usePartnerships";
import { PartnershipRequestsPanel } from "@/components/suppliers/partnership-requests-panel";
import { useSuppliers, type Supplier, useDeleteSupplierPartnership } from "@/hooks/useSuppliers";
import { useDistributors, type Distributor, useDeleteDistributorPartnership } from "@/hooks/useDistributors";
import { useRetailers, type Retailer, useDeleteRetailerPartnership } from "@/hooks/useRetailers";
import { useAuthStore } from "@/store/useAuthStore";
import { cn } from "@/lib/utils";
import { DistributorRequestsPanel } from "@/components/distributors/distributor-requests-panel";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

function SupplierNFTBadge({ supplierId }: { supplierId: string }) {
  const { data: nft, isLoading } = usePartnershipNFT(supplierId);
  if (isLoading || !nft) return null;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#DDD6FE] bg-[#F5F3FF] px-4 py-3">
      <Gem className="mt-0.5 h-4 w-4 shrink-0 text-[#7C3AED]" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-[#7C3AED]">{nft.token_name}</p>
        <p className="mt-0.5 font-mono text-xs text-[#64748B] truncate">{nft.mint_address}</p>
      </div>
      <a
        href={nft.explorer_url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-xs font-medium text-[#7C3AED] hover:underline shrink-0"
      >
        Explorer <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}

function DistributorNFTBadge({ distributorId }: { distributorId: string }) {
  const { data: nft, isLoading } = useDistributorPartnershipNFT(distributorId);
  if (isLoading || !nft) return null;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#DDD6FE] bg-[#F5F3FF] px-4 py-3">
      <Gem className="mt-0.5 h-4 w-4 shrink-0 text-[#7C3AED]" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-[#7C3AED]">{nft.token_name}</p>
        <p className="mt-0.5 font-mono text-xs text-[#64748B] truncate">{nft.mint_address}</p>
      </div>
      <a
        href={nft.explorer_url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-xs font-medium text-[#7C3AED] hover:underline shrink-0"
      >
        Explorer <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}

function RetailerNFTBadge({ retailerId }: { retailerId: string }) {
  const { data: nft, isLoading } = useRetailerPartnershipNFT(retailerId);
  if (isLoading || !nft) return null;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#DDD6FE] bg-[#F5F3FF] px-4 py-3">
      <Gem className="mt-0.5 h-4 w-4 shrink-0 text-[#7C3AED]" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-[#7C3AED]">{nft.token_name}</p>
        <p className="mt-0.5 font-mono text-xs text-[#64748B] truncate">{nft.mint_address}</p>
      </div>
      <a
        href={nft.explorer_url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-xs font-medium text-[#7C3AED] hover:underline shrink-0"
      >
        Explorer <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}

function TrustPanelStats({ summary, isLoading, description }: { summary?: PartnershipSummary; isLoading: boolean; description: string }) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 space-y-4">
        <Badge tone="info" className="w-fit">Trust and partnership</Badge>
        <h3 className="text-lg font-semibold text-[#0F172A]">Partnership trust layer</h3>
        <p className="text-sm leading-6 text-[#64748B]">{description}</p>

        {isLoading ? (
          <div className="space-y-2">
            <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
          </div>
        ) : summary ? (
          <div className="space-y-3">
            {/* NFT count */}
            <div className="flex items-center gap-3 rounded-xl border border-[#DDD6FE] bg-[#F5F3FF] px-4 py-3">
              <Gem className="h-4 w-4 text-[#7C3AED]" />
              <span className="text-sm text-[#6D28D9] font-medium">{summary.nft_issued} Partnership NFT on-chain</span>
            </div>
            {/* Stats row */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-[#F0FDF4] px-3 py-2 text-center">
                <p className="text-xs text-[#64748B]">Active</p>
                <p className="text-xl font-bold text-[#16A34A]">{summary.active_partnerships}</p>
              </div>
              <div className="rounded-lg bg-[#FFF7ED] px-3 py-2 text-center">
                <p className="text-xs text-[#64748B]">Pending</p>
                <p className="text-xl font-bold text-[#EA580C]">{summary.pending_agreements}</p>
              </div>
              <div className="rounded-lg bg-[#EFF6FF] px-3 py-2 text-center">
                <p className="text-xs text-[#64748B]">Trust score</p>
                <p className="text-xl font-bold text-[#1D4ED8]">{summary.trust_score}</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-center">
                <p className="text-xs text-[#64748B]">Growth</p>
                <p className="text-xl font-bold text-[#0F172A]">+{summary.network_growth}%</p>
              </div>
            </div>
            <a
              href="https://explorer.solana.com/?cluster=devnet"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-[#7C3AED] hover:underline"
            >
              Solana Devnet Explorer <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RetailerTrustPanel() {
  const { data, isLoading } = usePartnershipsSummary();
  return (
    <TrustPanelStats
      summary={data?.summary}
      isLoading={isLoading}
        description="Partnerships with distributors are protected by an on-chain trust layer. Partnership NFTs are issued when partnerships are approved."
    />
  );
}

function DistributorTrustPanel({ partnerType }: { partnerType: "supplier" | "retailer" }) {
  const { data, isLoading } = usePartnershipsSummary(partnerType);
  return (
    <TrustPanelStats
      summary={data?.summary}
      isLoading={isLoading}
      description={
        partnerType === "retailer"
          ? "Partnerships with retailers are protected by an on-chain trust layer. Partnership NFTs are issued when requests are approved."
          : "Partnerships with suppliers are protected by an on-chain trust layer. Partnership NFTs are issued when requests are approved."
      }
    />
  );
}

export default function PartnershipsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const isRetailer = role === "retailer";
  const isDistributor = role === "distributor";
  const isSupplier = role === "supplier";
  const [partnerView, setPartnerView] = useState<"suppliers" | "retailers">("suppliers");

  const summaryPartnerType = isDistributor
    ? (partnerView === "retailers" ? "retailer" : "supplier")
    : undefined;
  const { data: summaryData } = usePartnershipsSummary(summaryPartnerType);

  const distributorPanelPartnerType: "supplier" | "retailer" =
    partnerView === "retailers" ? "retailer" : "supplier";

  // Distributor view: fetch supplier partners
  const {
    data: suppliersData,
    isLoading: isSuppliersLoading,
    isError: isSuppliersError,
    refetch: refetchSuppliers,
  } = useSuppliers({ type: "partner" });

  // Retailer view: fetch distributor partners
  const {
    data: distributorsData,
    isLoading: isDistributorsLoading,
    isError: isDistributorsError,
    refetch: refetchDistributors,
  } = useDistributors({ type: "partner" });

  // Distributor view: fetch retailer partners
  const {
    data: retailersData,
    isLoading: isRetailersLoading,
    isError: isRetailersError,
    refetch: refetchRetailers,
  } = useRetailers({ type: "partner" });

  const [selectedDistributor, setSelectedDistributor] = useState<Distributor | null>(null);
  const [stockDialogOpen, setStockDialogOpen] = useState(false);
  const [supplierStockDialogOpen, setSupplierStockDialogOpen] = useState(false);
  const [selectedSupplierForStock, setSelectedSupplierForStock] = useState<Supplier | null>(null);
  const [distributorDetailOpen, setDistributorDetailOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
    type: "supplier" | "distributor" | "retailer";
    isPartner: boolean;
  } | null>(null);

  const deleteSupplierP = useDeleteSupplierPartnership();
  const deleteDistributorP = useDeleteDistributorPartnership();
  const deleteRetailerP = useDeleteRetailerPartnership();

  const summary = summaryData?.summary;
  const suppliers = suppliersData?.suppliers ?? [];
  const distributors = distributorsData?.distributors ?? [];
  const retailers = retailersData?.retailers ?? [];

  // Determine which data to display based on role and tab
  const isLoading = isRetailer
    ? isDistributorsLoading
    : isSupplier
      ? isDistributorsLoading
      : isDistributor && partnerView === "retailers"
        ? isRetailersLoading
        : isSuppliersLoading;
  const isError = isRetailer
    ? isDistributorsError
    : isSupplier
      ? isDistributorsError
      : isDistributor && partnerView === "retailers"
        ? isRetailersError
        : isSuppliersError;
  const refetch = isRetailer
    ? refetchDistributors
    : isSupplier
      ? refetchDistributors
      : isDistributor && partnerView === "retailers"
        ? refetchRetailers
        : refetchSuppliers;

  const partnerLabel = isRetailer
    ? "Active distributor partners"
    : isSupplier
      ? "Active distributor partners"
      : isDistributor && partnerView === "retailers"
        ? "Active retailer partners"
        : "Active supplier partners";

  const emptyText = isRetailer
    ? "Find distributors on the Distributors page."
    : isSupplier
      ? "No distributor partners yet. Find distributors on the Distributors page."
      : isDistributor && partnerView === "retailers"
        ? "No retailer partners yet. Manage retailers on the Retailers page."
        : "Find suppliers on the Suppliers page.";

  // Adapt PartnershipInsight to AiInsight format for the InsightCard component
  const adaptedInsights = useMemo(() => {
    const allInsights = summaryData?.insights ?? [];

    const filteredInsights = isDistributor
      ? partnerView === "suppliers"
        ? allInsights.filter((i) => i.supplier_id)
        : allInsights.filter((i) => i.retailer_id)
      : allInsights;

    return filteredInsights.map((i) => ({
      type: i.type,
      message: i.message,
      urgency: i.urgency,
      item_id: i.supplier_id ?? i.distributor_id ?? i.retailer_id ?? i.type,
    }));
  }, [summaryData?.insights, isDistributor, partnerView]);

  return (
    <main className="space-y-6 px-6 py-6 lg:px-8 lg:py-8">
      {/* Header */}
      <section className="flex flex-col gap-4 rounded-3xl border border-[#E2E8F0] bg-white px-6 py-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <Badge tone="info">Partnership Hub</Badge>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-[#0F172A]">Partnerships & Trust</h1>
            <p className="max-w-3xl text-sm leading-7 text-[#64748B]">
              {isRetailer
                ? "Manage partnerships with distributors, verify trust layer, and monitor partner ecosystem metrics."
                : role === "supplier"
                  ? "Manage partnerships with distributor partners, verify trust layer, and monitor distribution metrics."
                  : "Manage partnerships with suppliers and retailers, verify trust layer on-chain, and monitor comprehensive partner ecosystem metrics."}
            </p>
          </div>
        </div>
      </section>

      {/* Distributor tab */}
      {isDistributor && (
        <div className="flex gap-2 rounded-lg border border-[#E2E8F0] bg-slate-50 p-1">
          <button
            onClick={() => setPartnerView("suppliers")}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              partnerView === "suppliers"
                ? "bg-white text-[#0F172A] shadow-sm"
                : "text-[#64748B] hover:text-[#0F172A]"
            )}
          >
            Supplier Partners
          </button>
          <button
            onClick={() => setPartnerView("retailers")}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              partnerView === "retailers"
                ? "bg-white text-[#0F172A] shadow-sm"
                : "text-[#64748B] hover:text-[#0F172A]"
            )}
          >
            Retailer Partners
          </button>
        </div>
      )}

      {/* KPI cards */}
      {summary && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <KpiCard
            label="Active Partnerships"
            value={String(summary.active_partnerships)}
            meta={partnerLabel}
            tone="success"
            icon={Handshake}
          />
          <KpiCard
            label="Pending Agreements"
            value={String(summary.pending_agreements)}
            meta="Awaiting approval"
            tone="warning"
            icon={FileClock}
          />
          <KpiCard
            label="Renewal Rate"
            value={`${summary.contract_renewal_rate}%`}
            meta="Contract retention"
            tone="info"
            icon={Percent}
          />
          <KpiCard
            label="Trust Score"
            value={String(summary.trust_score)}
            meta="Average credibility"
            tone="success"
            icon={ShieldCheck}
          />
          <KpiCard
            label="Network Growth"
            value={`+${summary.network_growth}%`}
            meta="Last 30 days"
            tone="info"
            icon={TrendingUp}
          />
        </section>
      )}

      {/* AI Insights */}
      {adaptedInsights.length > 0 && (
        <section>
          <InsightCard insights={adaptedInsights} />
        </section>
      )}

      {/* Main content */}
      <section className="grid gap-6 xl:grid-cols-[1.5fr_0.85fr]">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-[#0F172A]">Active Agreements</h2>

          {isLoading && (
            <div className="flex h-32 items-center justify-center rounded-2xl border border-[#E2E8F0] bg-white">
              <span className="text-sm text-[#64748B]">Loading partners...</span>
            </div>
          )}

          {isError && !isLoading && (
            <PageErrorState message="Failed to load partnership data" onRetry={() => refetch()} />
          )}

          {/* Retailer: distributor partners */}
          {isRetailer && !isLoading && !isError && distributors.length === 0 && (
            <div className="flex h-32 flex-col items-center justify-center rounded-2xl border border-[#E2E8F0] bg-white">
              <span className="text-sm font-medium text-[#0F172A]">No active partnerships</span>
              <span className="mt-1 text-xs text-[#64748B]">{emptyText}</span>
            </div>
          )}

          {isRetailer && !isLoading && !isError && distributors.length > 0 && (
            <div className="grid gap-4">
              {(distributors as Distributor[]).map((dist) => (
                <div key={dist.distributor_id} className="space-y-2">
                  <DistributorCard
                    distributor={dist}
                    role="retailer"
                    onViewStock={(d) => { setSelectedDistributor(d); setStockDialogOpen(true); }}
                    onViewDetail={(d) => { setSelectedDistributor(d); setDistributorDetailOpen(true); }}
                    onDeletePartnership={(d) => setDeleteTarget({ id: d.distributor_id, name: d.name, type: "distributor", isPartner: d.partnership_status === "partner" })}
                  />
                  <DistributorNFTBadge distributorId={dist.distributor_id} />
                </div>
              ))}
            </div>
          )}

          {/* Supplier: distributor partners */}
          {isSupplier && !isLoading && !isError && distributors.length === 0 && (
            <div className="flex h-32 flex-col items-center justify-center rounded-2xl border border-[#E2E8F0] bg-white">
              <span className="text-sm font-medium text-[#0F172A]">No distributor partners</span>
              <span className="mt-1 text-xs text-[#64748B]">Find distributors on the Distributors page.</span>
            </div>
          )}

          {isSupplier && !isLoading && !isError && distributors.length > 0 && (
            <div className="grid gap-4">
              {(distributors as Distributor[]).map((dist) => (
                <div key={dist.distributor_id} className="space-y-2">
                  <DistributorCard
                    distributor={dist}
                    role="supplier"
                    onViewDetail={(d) => { setSelectedDistributor(d); setDistributorDetailOpen(true); }}
                    onDeletePartnership={(d) => setDeleteTarget({ id: d.distributor_id, name: d.name, type: "distributor", isPartner: d.partnership_status === "partner" })}
                  />
                  <DistributorNFTBadge distributorId={dist.distributor_id} />
                </div>
              ))}
            </div>
          )}

          {/* Distributor tab "suppliers": supplier partners */}
          {isDistributor && partnerView === "suppliers" && !isLoading && !isError && suppliers.length === 0 && (
            <div className="flex h-32 flex-col items-center justify-center rounded-2xl border border-[#E2E8F0] bg-white">
              <span className="text-sm font-medium text-[#0F172A]">No active partnerships</span>
              <span className="mt-1 text-xs text-[#64748B]">{emptyText}</span>
            </div>
          )}

          {isDistributor && partnerView === "suppliers" && !isLoading && !isError && suppliers.length > 0 && (
            <div className="grid gap-4">
              {(suppliers as Supplier[]).map((supplier) => (
                <div key={supplier.supplier_id} className="space-y-2">
                  <SupplierCard
                    supplier={supplier}
                    onViewStock={(s) => { setSelectedSupplierForStock(s); setSupplierStockDialogOpen(true); }}
                    onDeletePartnership={(s) => setDeleteTarget({ id: s.supplier_id, name: s.name, type: "supplier", isPartner: s.type === "partner" })}
                  />
                  <SupplierNFTBadge supplierId={supplier.supplier_id} />
                </div>
              ))}
            </div>
          )}

          {/* Distributor tab "retailers": retailer partners */}
          {isDistributor && partnerView === "retailers" && !isLoading && !isError && retailers.length === 0 && (
            <div className="flex h-32 flex-col items-center justify-center rounded-2xl border border-[#E2E8F0] bg-white">
              <span className="text-sm font-medium text-[#0F172A]">No retailer partners</span>
              <span className="mt-1 text-xs text-[#64748B]">{emptyText}</span>
            </div>
          )}

          {isDistributor && partnerView === "retailers" && !isLoading && !isError && retailers.length > 0 && (
            <div className="grid gap-4">
              {(retailers as Retailer[]).map((retailer) => (
                <div key={retailer.retailer_id} className="space-y-2">
                  <RetailerCard
                    retailer={retailer}
                    onDeletePartnership={(r) => setDeleteTarget({ id: r.retailer_id, name: r.name, type: "retailer", isPartner: true })}
                  />
                  <RetailerNFTBadge retailerId={retailer.retailer_id} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Side panel */}
        <div className="space-y-6">
          {isSupplier && <PartnershipRequestsPanel />}
          {isDistributor && partnerView === "retailers" && <DistributorRequestsPanel />}
          {isRetailer ? (
            <RetailerTrustPanel />
          ) : isDistributor ? (
            <DistributorTrustPanel partnerType={distributorPanelPartnerType} />
          ) : (
            <SuppliersTrustPanel />
          )}
        </div>
      </section>

      {/* Stock dialog — retailer only */}
      {isRetailer && (
        <DistributorStockDialog
          distributorId={selectedDistributor?.distributor_id ?? null}
          distributorName={selectedDistributor?.name ?? ""}
          open={stockDialogOpen}
          onClose={() => setStockDialogOpen(false)}
        />
      )}

      {/* Supplier Stock dialog */}
      {selectedSupplierForStock && (
        <SupplierStockDialog
          supplierId={selectedSupplierForStock.supplier_id}
          supplierName={selectedSupplierForStock.name}
          open={supplierStockDialogOpen}
          onClose={() => { setSupplierStockDialogOpen(false); setSelectedSupplierForStock(null); }}
        />
      )}

      {/* Distributor Detail Dialog */}
      {distributorDetailOpen && selectedDistributor && (
        <DistributorDetailDialog
          open={distributorDetailOpen}
          onClose={() => setDistributorDetailOpen(false)}
          distributor={selectedDistributor}
          role={isRetailer ? "retailer" : "supplier"}
        />
      )}

      {/* Delete partnership confirm dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          if (deleteTarget.type === "supplier") {
            deleteSupplierP.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
          } else if (deleteTarget.type === "distributor") {
            deleteDistributorP.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
          } else {
            deleteRetailerP.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
          }
        }}
        title={deleteTarget?.isPartner ? "End Partnership" : "Cancel Request"}
        description={
          deleteTarget?.isPartner
            ? `Are you sure you want to end the partnership with ${deleteTarget?.name}? This action cannot be undone.`
            : `Are you sure you want to cancel the partnership request to ${deleteTarget?.name}?`
        }
        confirmLabel={deleteTarget?.isPartner ? "End Partnership" : "Cancel Request"}
        isLoading={deleteSupplierP.isPending || deleteDistributorP.isPending || deleteRetailerP.isPending}
      />
    </main>
  );
}
