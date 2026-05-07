"use client";

import { useCallback, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  Clock,
  Handshake,
  Loader2,
  Network,
  Plus,
  Search,
  Trash2,
  Truck,
  XCircle,
} from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { PageErrorState } from "@/components/dashboard/page-error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DistributorCard } from "@/components/distributors/distributor-card";
import { DistributorDetailDialog } from "@/components/distributors/distributor-detail-dialog";
import { DistributorStockDialog } from "@/components/distributors/distributor-stock-dialog";
import { PartnershipRequestDetailDialog } from "@/components/distributors/partnership-request-detail-dialog";
import { PartnershipRequestsPanel } from "@/components/suppliers/partnership-requests-panel";
import {
  useDistributors,
  useDistributorRequests,
  useRespondDistributorRequest,
  useRequestDistributorPartnership,
  useDeleteDistributorPartnership,
  type Distributor,
  type DistributorPartnershipRequest,
} from "@/hooks/useDistributors";
import { useAuthStore } from "@/store/useAuthStore";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

export default function DistributorsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
const [selectedDistributor, setSelectedDistributor] = useState<Distributor | null>(null);
  const [stockDialogOpen, setStockDialogOpen] = useState(false);
  const [distributorDetailOpen, setDistributorDetailOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<DistributorPartnershipRequest | null>(null);
  const [requestDetailOpen, setRequestDetailOpen] = useState(false);

  const handleViewStock = useCallback((distributor: Distributor) => {
    setSelectedDistributor(distributor);
    setStockDialogOpen(true);
  }, []);

  const handleViewDetail = useCallback((distributor: Distributor) => {
    setSelectedDistributor(distributor);
    setDistributorDetailOpen(true);
  }, []);

  const { data, isLoading, isError, refetch } = useDistributors({
    search,
    status: statusFilter !== "all" ? statusFilter : undefined,
    type: role === "retailer" ? "partner" : undefined,
  });

  const {
    data: requestsData,
    isLoading: isRequestsLoading,
    isError: isRequestsError,
    refetch: refetchRequests,
  } = useDistributorRequests("pending");

  const respond = useRespondDistributorRequest();
  const requestPartnership = useRequestDistributorPartnership();
  const deletePartnership = useDeleteDistributorPartnership();
  const [deleteTarget, setDeleteTarget] = useState<Distributor | null>(null);

  if (role !== "supplier" && role !== "retailer") {
    return (
      <main className="flex h-[80vh] items-center justify-center p-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-[#0F172A]">Akses Ditolak</h2>
          <p className="mt-2 text-sm text-[#64748B]">
            Halaman ini hanya untuk Supplier dan Retailer.
          </p>
        </div>
      </main>
    );
  }

  const isRetailer = role === "retailer";
  const distributors = data?.distributors ?? [];
  const summary = data?.summary;
  const requests = requestsData?.requests ?? [];

  return (
    <main className="space-y-6 px-6 py-6 lg:px-8 lg:py-8">
      {/* Header */}
      <section className="flex flex-col gap-4 rounded-3xl border border-[#E2E8F0] bg-white px-6 py-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <Badge tone="info">
            {isRetailer ? "Distributor catalog" : "Partner Network"}
          </Badge>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-[#0F172A]">
              {isRetailer ? "Distributors" : "Distributor Management"}
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-[#64748B]">
              {isRetailer
                ? "Temukan distributor partner, lihat ketersediaan stok, dan kirim permintaan kemitraan."
                : "Kelola distributor partner, pantau performa order dan ketepatan pembayaran, serta tanggapi permintaan kemitraan baru."}
            </p>
          </div>
        </div>
        {isRetailer && (
          <div className="flex flex-wrap gap-3">
            <Button className="gap-2" onClick={() => { setSearch(""); setStatusFilter(""); }}>
              <Plus className="h-4 w-4" />
              Explore Distributors
            </Button>
          </div>
        )}
      </section>

      {/* KPI cards */}
      {summary && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label={isRetailer ? "Partner Distributors" : "Active Partners"}
            value={String(summary.partner_count)}
            meta={isRetailer ? "Distributor partner aktif" : "Distributor partner aktif"}
            tone="success"
            icon={Handshake}
          />
          <KpiCard
            label="Pending Requests"
            value={String(summary.pending_count)}
            meta="Menunggu persetujuan"
            tone="warning"
            icon={Clock}
          />
          {isRetailer ? (
            <KpiCard
              label="Avg. Delivery"
              value={`${summary.avg_delivery_days} hari`}
              meta="Rata-rata waktu pengiriman"
              tone="info"
              icon={Truck}
            />
          ) : (
            <KpiCard
              label="Total Order Volume"
              value={String(summary.total_order_volume)}
              meta="Pesanan dari distributor"
              tone="info"
              icon={BarChart3}
            />
          )}
          {isRetailer ? (
            <KpiCard
              label="Total Pesanan"
              value={String(summary.total_order_volume)}
              meta="Pesanan ke distributor"
              tone="info"
              icon={BarChart3}
            />
          ) : (
            <KpiCard
              label="Avg. Punctuality"
              value={`${summary.avg_punctuality}%`}
              meta="Ketepatan pembayaran"
              tone="success"
              icon={CheckCircle2}
            />
          )}
        </section>
      )}

      {/* Search & Filter */}
      <section className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
          <Input
            placeholder="Cari distributor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex rounded-lg border border-[#E2E8F0] bg-slate-50 p-1">
          {["all", "partner", "pending"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
                statusFilter === s
                  ? "bg-white text-[#0F172A] shadow-sm"
                  : "text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              {s === "all" ? "Semua" : s === "partner" ? "Partner" : "Pending"}
            </button>
          ))}
        </div>
      </section>

      {/* Main content */}
      <section className="grid gap-6 xl:grid-cols-[1.5fr_0.85fr]">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-[#0F172A]">Distributor List</h2>

          {isLoading && (
            <div className="flex h-32 items-center justify-center rounded-2xl border border-[#E2E8F0] bg-white">
              <Loader2 className="h-5 w-5 animate-spin text-[#94A3B8]" />
            </div>
          )}

          {isError && !isLoading && (
            <PageErrorState
              message="Gagal memuat data distributor"
              onRetry={() => refetch()}
            />
          )}

          {!isLoading && !isError && distributors.length === 0 && (
            <div className="flex h-32 flex-col items-center justify-center rounded-2xl border border-[#E2E8F0] bg-white">
              <span className="text-sm font-medium text-[#0F172A]">
                Belum ada distributor ditemukan
              </span>
              <span className="mt-1 text-xs text-[#64748B]">
                {isRetailer
                  ? "Cari distributor di halaman ini atau kirim permintaan kemitraan."
                  : "Distributor yang menjalin kemitraan akan muncul di sini."}
              </span>
            </div>
          )}

          {!isLoading && !isError && distributors.length > 0 && (
            <div className="grid gap-4">
              {isRetailer ? (
                distributors.map((dist) => (
                  <DistributorCard
                    key={dist.distributor_id}
                    distributor={dist}
                    role="retailer"
                    onRequestPartnership={
                      dist.partnership_status === "none"
                        ? (d) => requestPartnership.mutate(d.distributor_id)
                        : undefined
                    }
                    isRequesting={requestPartnership.isPending}
                    onViewStock={
                      dist.partnership_status === "partner"
                        ? handleViewStock
                        : undefined
                    }
                    onDeletePartnership={
                      dist.partnership_status !== "none"
                        ? (d) => setDeleteTarget(d)
                        : undefined
                    }
                  />
                ))
              ) : (
                distributors.map((dist) => (
                  <Card key={dist.distributor_id} className="rounded-2xl">
                    <CardContent className="flex items-center justify-between gap-4 p-5">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-[#3B82F6]">
                          <Handshake className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="font-semibold text-[#0F172A]">{dist.name}</p>
                          <p className="mt-0.5 text-xs text-[#64748B]">{dist.region}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        {dist.partnership_status === "partner" && (
                          <>
                            <div className="text-right">
                              <p className="text-xs text-[#64748B]">Orders</p>
                              <p className="text-sm font-semibold text-[#0F172A]">
                                {dist.order_volume}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-[#64748B]">Punctuality</p>
                              <p className="text-sm font-semibold text-[#22C55E]">
                                {dist.payment_punctuality}%
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-[#64748B]">Score</p>
                              <p className="text-sm font-semibold text-[#3B82F6]">
                                {dist.reputation_score}
                              </p>
                            </div>
                          </>
                        )}
                        <Badge
                          tone={
                            dist.partnership_status === "partner"
                              ? "success"
                              : dist.partnership_status === "pending"
                                ? "warning"
                                : "neutral"
                          }
                        >
                          {dist.partnership_status === "partner"
                            ? "Partner"
                            : dist.partnership_status === "pending"
                              ? "Pending"
                              : "Belum Partner"}
                        </Badge>
                        {dist.partnership_status === "partner" && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleViewDetail(dist)}
                          >
                            Lihat Detail
                          </Button>
                        )}
                        {dist.partnership_status !== "none" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => setDeleteTarget(dist)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </div>

        {/* Side panel — role-aware */}
        <div className="space-y-4">
          {!isRetailer && role === "supplier" && (
            <PartnershipRequestsPanel />
          )}
          {isRetailer ? (
            <Card className="rounded-2xl">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-center gap-2">
                  <Network className="h-5 w-5 text-[#3B82F6]" />
                  <h3 className="text-sm font-semibold text-[#0F172A]">Kenapa bermitra dengan distributor?</h3>
                </div>
                <p className="text-sm leading-6 text-[#64748B]">
                  Distributor menyediakan akses ke berbagai produk dengan harga kompetitif dan pengiriman terjadwal.
                  Bermitra dengan distributor yang tepat membantu kamu menjaga stok toko tetap tersedia.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-[#0F172A]">
                    <CheckCircle2 className="h-4 w-4 text-[#22C55E]" />
                    Akses stok real-time
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#0F172A]">
                    <CheckCircle2 className="h-4 w-4 text-[#22C55E]" />
                    Fasilitas credit line
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#0F172A]">
                    <CheckCircle2 className="h-4 w-4 text-[#22C55E]" />
                    Pengiriman terjadwal
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : role !== "supplier" ? (
            <> {/* distributor-side: requests from retailers */}
              <h2 className="text-lg font-semibold text-[#0F172A]">Partnership Requests</h2>
              <Card className="rounded-2xl">
                <CardContent className="pt-6">
                  {isRequestsLoading && (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-[#94A3B8]" />
                    </div>
                  )}

                  {isRequestsError && !isRequestsLoading && (
                    <PageErrorState
                      message="Gagal memuat permintaan kemitraan"
                      onRetry={() => refetchRequests()}
                    />
                  )}

                  {!isRequestsLoading && !isRequestsError && requests.length === 0 && (
                    <p className="text-center text-sm text-[#64748B]">
                      Tidak ada permintaan kemitraan baru.
                    </p>
                  )}

                  {!isRequestsLoading && !isRequestsError && requests.length > 0 && (
                    <div className="space-y-4">
                      {requests.map((req) => (
                        <div
                          key={req.request_id}
                          className="flex items-center justify-between border-b border-[#E2E8F0] pb-4 last:border-0 last:pb-0 cursor-pointer hover:bg-slate-50 -mx-2 px-2 rounded-lg transition-colors"
                          onClick={() => { setSelectedRequest(req); setRequestDetailOpen(true); }}
                        >
                          <div>
                            <p className="text-sm font-semibold text-[#0F172A]">
                              {req.distributor?.business_name ?? req.distributor_name ?? "—"}
                            </p>
                            <p className="mt-0.5 text-xs text-[#64748B]">
                              {new Intl.DateTimeFormat("id-ID", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              }).format(new Date(req.created_at))}
                            </p>
                          </div>
                          <Badge tone="warning">
                            Lihat Detail
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : null}
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

      {/* Detail dialog — supplier & retailer */}
      <DistributorDetailDialog
        distributor={selectedDistributor}
        open={distributorDetailOpen}
        onClose={() => setDistributorDetailOpen(false)}
        role={isRetailer ? "retailer" : "supplier"}
      />

      {/* Partnership request detail dialog — supplier only */}
      <PartnershipRequestDetailDialog
        request={selectedRequest}
        open={requestDetailOpen}
        onClose={() => { setRequestDetailOpen(false); setSelectedRequest(null); }}
        onAccept={(request_id) => {
          respond.mutate({ request_id, action: "accept" }, {
            onSuccess: () => { setRequestDetailOpen(false); setSelectedRequest(null); },
          });
        }}
        onReject={(request_id) => {
          respond.mutate({ request_id, action: "reject" }, {
            onSuccess: () => { setRequestDetailOpen(false); setSelectedRequest(null); },
          });
        }}
        isProcessing={respond.isPending}
      />

      {/* Delete partnership confirm dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deletePartnership.mutate(deleteTarget.distributor_id, {
            onSuccess: () => setDeleteTarget(null),
          });
        }}
        title={deleteTarget?.partnership_status === "partner" ? "Putus Kemitraan" : "Batalkan Permintaan"}
        description={
          deleteTarget?.partnership_status === "partner"
            ? `Apakah Anda yakin ingin memutus kemitraan dengan ${deleteTarget?.name}? Tindakan ini tidak dapat dibatalkan.`
            : `Apakah Anda yakin ingin membatalkan permintaan kemitraan dengan ${deleteTarget?.name}?`
        }
        confirmLabel={deleteTarget?.partnership_status === "partner" ? "Putus Kemitraan" : "Batalkan Permintaan"}
        isLoading={deletePartnership.isPending}
      />
    </main>
  );
}