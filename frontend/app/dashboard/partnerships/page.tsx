"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Gem, Handshake, FileClock, Percent, ShieldCheck, TrendingUp } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { InsightCard } from "@/components/dashboard/insight-card";
import { SupplierCard } from "@/components/suppliers/supplier-card";
import { RetailerCard } from "@/components/retailers/retailer-card";
import { DistributorCard } from "@/components/distributors/distributor-card";
import { DistributorStockDialog } from "@/components/distributors/distributor-stock-dialog";
import { DistributorDetailDialog } from "@/components/distributors/distributor-detail-dialog";
import { SuppliersTrustPanel } from "@/components/suppliers/suppliers-trust-panel";
import { PageErrorState } from "@/components/dashboard/page-error-state";
import { Badge } from "@/components/ui/badge";
import { usePartnershipsSummary, usePartnershipNFT, useDistributorPartnershipNFT, useRetailerPartnershipNFT } from "@/hooks/usePartnerships";
import { useSuppliers, type Supplier } from "@/hooks/useSuppliers";
import { useDistributors, type Distributor } from "@/hooks/useDistributors";
import { useRetailers, type Retailer } from "@/hooks/useRetailers";
import { useAuthStore } from "@/store/useAuthStore";
import { cn } from "@/lib/utils";

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

function RetailerTrustPanel() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 space-y-4">
        <Badge tone="info" className="w-fit">Trust and partnership</Badge>
        <h3 className="text-lg font-semibold text-[#0F172A]">Partnership trust layer</h3>
        <p className="text-sm leading-6 text-[#64748B]">
          Kemitraan dengan distributor dilindungi trust layer on-chain. Partnership NFT diterbitkan saat kemitraan disetujui.
        </p>
      </div>
    </div>
  );
}

function DistributorTrustPanel() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 space-y-4">
        <Badge tone="info" className="w-fit">Trust and partnership</Badge>
        <h3 className="text-lg font-semibold text-[#0F172A]">Partnership trust layer</h3>
        <p className="text-sm leading-6 text-[#64748B]">
          Kemitraan dengan supplier dan retailer dilindungi trust layer on-chain. Partnership NFT diterbitkan saat kemitraan disetujui di kedua arah.
        </p>
      </div>
    </div>
  );
}

export default function PartnershipsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const { data: summaryData } = usePartnershipsSummary();

  const isRetailer = role === "retailer";
  const isDistributor = role === "distributor";
  const isSupplier = role === "supplier";
  const [partnerView, setPartnerView] = useState<"suppliers" | "retailers">("suppliers");

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
  const [distributorDetailOpen, setDistributorDetailOpen] = useState(false);

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
    ? "Distributor partner aktif"
    : isSupplier
      ? "Distributor partner aktif"
      : isDistributor && partnerView === "retailers"
        ? "Retailer partner aktif"
        : "Supplier partner aktif";

  const emptyText = isRetailer
    ? "Cari distributor di halaman Distributors."
    : isSupplier
      ? "Belum ada distributor partner. Cari distributor di halaman Distributors."
      : isDistributor && partnerView === "retailers"
        ? "Belum ada retailer partner. Kelola retailer di halaman Retailers."
        : "Cari supplier di halaman Suppliers.";

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
                ? "Kelola kemitraan dengan distributor, verifikasi trust layer, dan pantau metrik ekosistem partner."
                : role === "supplier"
                  ? "Kelola kemitraan dengan distributor partner, verifikasi trust layer, dan pantau metrik distribusi."
                  : "Kelola kemitraan dengan supplier dan retailer, verifikasi trust layer secara on-chain, dan pantau metrik ekosistem partner secara komprehensif."}
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
            meta="Menunggu persetujuan"
            tone="warning"
            icon={FileClock}
          />
          <KpiCard
            label="Renewal Rate"
            value={`${summary.contract_renewal_rate}%`}
            meta="Retensi kontrak"
            tone="info"
            icon={Percent}
          />
          <KpiCard
            label="Trust Score"
            value={String(summary.trust_score)}
            meta="Rata-rata kredibilitas"
            tone="success"
            icon={ShieldCheck}
          />
          <KpiCard
            label="Network Growth"
            value={`+${summary.network_growth}%`}
            meta="Dalam 30 hari terakhir"
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
              <span className="text-sm text-[#64748B]">Memuat data partner...</span>
            </div>
          )}

          {isError && !isLoading && (
            <PageErrorState message="Gagal memuat data partnership" onRetry={() => refetch()} />
          )}

          {/* Retailer: distributor partners */}
          {isRetailer && !isLoading && !isError && distributors.length === 0 && (
            <div className="flex h-32 flex-col items-center justify-center rounded-2xl border border-[#E2E8F0] bg-white">
              <span className="text-sm font-medium text-[#0F172A]">Belum ada active partnership</span>
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
                  />
                  <DistributorNFTBadge distributorId={dist.distributor_id} />
                </div>
              ))}
            </div>
          )}

          {/* Supplier: distributor partners */}
          {isSupplier && !isLoading && !isError && distributors.length === 0 && (
            <div className="flex h-32 flex-col items-center justify-center rounded-2xl border border-[#E2E8F0] bg-white">
              <span className="text-sm font-medium text-[#0F172A]">Belum ada distributor partner</span>
              <span className="mt-1 text-xs text-[#64748B]">Cari distributor di halaman Distributors.</span>
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
                  />
                  <DistributorNFTBadge distributorId={dist.distributor_id} />
                </div>
              ))}
            </div>
          )}

          {/* Distributor tab "suppliers": supplier partners */}
          {isDistributor && partnerView === "suppliers" && !isLoading && !isError && suppliers.length === 0 && (
            <div className="flex h-32 flex-col items-center justify-center rounded-2xl border border-[#E2E8F0] bg-white">
              <span className="text-sm font-medium text-[#0F172A]">Belum ada active partnership</span>
              <span className="mt-1 text-xs text-[#64748B]">{emptyText}</span>
            </div>
          )}

          {isDistributor && partnerView === "suppliers" && !isLoading && !isError && suppliers.length > 0 && (
            <div className="grid gap-4">
              {(suppliers as Supplier[]).map((supplier) => (
                <div key={supplier.supplier_id} className="space-y-2">
                  <SupplierCard supplier={supplier} />
                  <SupplierNFTBadge supplierId={supplier.supplier_id} />
                </div>
              ))}
            </div>
          )}

          {/* Distributor tab "retailers": retailer partners */}
          {isDistributor && partnerView === "retailers" && !isLoading && !isError && retailers.length === 0 && (
            <div className="flex h-32 flex-col items-center justify-center rounded-2xl border border-[#E2E8F0] bg-white">
              <span className="text-sm font-medium text-[#0F172A]">Belum ada retailer partner</span>
              <span className="mt-1 text-xs text-[#64748B]">{emptyText}</span>
            </div>
          )}

          {isDistributor && partnerView === "retailers" && !isLoading && !isError && retailers.length > 0 && (
            <div className="grid gap-4">
              {(retailers as Retailer[]).map((retailer) => (
                <div key={retailer.retailer_id} className="space-y-2">
                  <RetailerCard retailer={retailer} />
                  <RetailerNFTBadge retailerId={retailer.retailer_id} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Side panel */}
        {isRetailer ? (
          <RetailerTrustPanel />
        ) : isDistributor && partnerView === "retailers" ? (
          <DistributorTrustPanel />
        ) : (
          <SuppliersTrustPanel />
        )}
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

      {/* Distributor Detail Dialog */}
      {distributorDetailOpen && selectedDistributor && (
        <DistributorDetailDialog
          open={distributorDetailOpen}
          onClose={() => setDistributorDetailOpen(false)}
          distributor={selectedDistributor}
          role={isRetailer ? "retailer" : "supplier"}
        />
      )}
    </main>
  );
}