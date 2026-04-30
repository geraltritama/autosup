"use client";

import { useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  Clock,
  Handshake,
  Loader2,
  Search,
  XCircle,
} from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { PageErrorState } from "@/components/dashboard/page-error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  useDistributors,
  useDistributorRequests,
  useRespondDistributorRequest,
} from "@/hooks/useDistributors";
import { useAuthStore } from "@/store/useAuthStore";

export default function DistributorsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useDistributors({ search, status: statusFilter });
  const {
    data: requestsData,
    isLoading: isRequestsLoading,
    isError: isRequestsError,
    refetch: refetchRequests,
  } = useDistributorRequests("pending");
  const respond = useRespondDistributorRequest();

  if (role !== "supplier") {
    return (
      <main className="flex h-[80vh] items-center justify-center p-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-[#0F172A]">Akses Ditolak</h2>
          <p className="mt-2 text-sm text-[#64748B]">
            Halaman Distributor Management khusus untuk Supplier.
          </p>
        </div>
      </main>
    );
  }

  const distributors = data?.distributors ?? [];
  const summary = data?.summary;
  const requests = requestsData?.requests ?? [];

  return (
    <main className="space-y-6 px-6 py-6 lg:px-8 lg:py-8">
      {/* Header */}
      <section className="flex flex-col gap-4 rounded-3xl border border-[#E2E8F0] bg-white px-6 py-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <Badge tone="info">Partner Network</Badge>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-[#0F172A]">
              Distributor Management
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-[#64748B]">
              Kelola distributor partner, pantau performa order dan ketepatan pembayaran, serta tanggapi permintaan kemitraan baru.
            </p>
          </div>
        </div>
      </section>

      {/* KPI cards */}
      {summary && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Active Partners"
            value={String(summary.partner_count)}
            meta="Distributor partner aktif"
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
          <KpiCard
            label="Total Order Volume"
            value={String(summary.total_order_volume)}
            meta="Pesanan dari distributor"
            tone="info"
            icon={BarChart3}
          />
          <KpiCard
            label="Avg. Punctuality"
            value={`${summary.avg_punctuality}%`}
            meta="Ketepatan pembayaran"
            tone="success"
            icon={CheckCircle2}
          />
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
                Distributor yang menjalin kemitraan akan muncul di sini.
              </span>
            </div>
          )}

          {!isLoading && !isError && distributors.length > 0 && (
            <div className="grid gap-4">
              {distributors.map((dist) => (
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
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Partnership requests side panel */}
        <div className="space-y-4">
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
                      className="flex items-center justify-between border-b border-[#E2E8F0] pb-4 last:border-0 last:pb-0"
                    >
                      <div>
                        <p className="text-sm font-semibold text-[#0F172A]">
                          {req.distributor.business_name}
                        </p>
                        <p className="mt-0.5 text-xs text-[#64748B]">
                          {new Intl.DateTimeFormat("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          }).format(new Date(req.created_at))}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            respond.mutate({
                              request_id: req.request_id,
                              action: "accept",
                            })
                          }
                          disabled={respond.isPending}
                        >
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Terima
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            respond.mutate({
                              request_id: req.request_id,
                              action: "reject",
                            })
                          }
                          disabled={respond.isPending}
                        >
                          <XCircle className="mr-1 h-3 w-3" />
                          Tolak
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
