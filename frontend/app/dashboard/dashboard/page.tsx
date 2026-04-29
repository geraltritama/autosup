"use client";

import Link from "next/link";
import {
  AlertCircle,
  Boxes,
  Building2,
  Clock3,
  Package,
  PackageCheck,
  RefreshCw,
  ShoppingCart,
  Sparkles,
  Users,
} from "lucide-react";
import { useDashboard, type DashboardSummary } from "@/hooks/useDashboard";
import { useAuthStore } from "@/store/useAuthStore";
import { InsightCard } from "@/components/dashboard/insight-card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// ─── Loading ────────────────────────────────────────────────────────────────

function DashboardLoading() {
  return (
    <main className="space-y-8 px-6 py-6 lg:px-8 lg:py-8">
      <div className="h-32 animate-pulse rounded-3xl bg-slate-100" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
      <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />
    </main>
  );
}

// ─── Error ───────────────────────────────────────────────────────────────────

function DashboardError({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-[#EF4444]">
        <AlertCircle className="h-6 w-6" />
      </div>
      <div className="space-y-1 text-center">
        <p className="font-semibold text-[#0F172A]">Gagal memuat dashboard</p>
        <p className="text-sm text-[#64748B]">Cek koneksi kamu dan coba lagi.</p>
      </div>
      <Button variant="secondary" onClick={onRetry} className="gap-2">
        <RefreshCw className="h-4 w-4" />
        Coba lagi
      </Button>
    </main>
  );
}

// ─── Empty ───────────────────────────────────────────────────────────────────

function DashboardEmpty({ role }: { role: "distributor" | "supplier" }) {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[#3B82F6]">
        <Sparkles className="h-6 w-6" />
      </div>
      <div className="space-y-1 text-center">
        <p className="font-semibold text-[#0F172A]">Dashboard kamu masih kosong</p>
        <p className="text-sm text-[#64748B]">
          {role === "distributor"
            ? "Mulai dengan menambahkan item ke inventory."
            : "Mulai dengan mengelola stok produk kamu."}
        </p>
      </div>
      <Link href={role === "distributor" ? "/dashboard/inventory" : "/dashboard/inventory"}>
        <Button className="gap-2">
          <Boxes className="h-4 w-4" />
          {role === "distributor" ? "Tambah inventory" : "Kelola produk"}
        </Button>
      </Link>
    </main>
  );
}

// ─── Distributor dashboard ────────────────────────────────────────────────────

function DistributorDashboard({ data }: { data: Extract<DashboardSummary, { role: "distributor" }> }) {
  const isEmpty =
    data.inventory.total_items === 0 &&
    data.orders.active_orders === 0 &&
    data.suppliers.partner_count === 0;

  if (isEmpty) return <DashboardEmpty role="distributor" />;

  const kpis = [
    {
      label: "Total inventory",
      value: String(data.inventory.total_items),
      meta: `${data.inventory.low_stock_count} low stock`,
      tone: data.inventory.low_stock_count > 0 ? ("warning" as const) : ("success" as const),
      icon: Boxes,
    },
    {
      label: "Order aktif",
      value: String(data.orders.active_orders),
      meta: `${data.orders.pending_orders} pending`,
      tone: data.orders.pending_orders > 0 ? ("warning" as const) : ("success" as const),
      icon: ShoppingCart,
    },
    {
      label: "Supplier partner",
      value: String(data.suppliers.partner_count),
      meta:
        data.suppliers.pending_requests > 0
          ? `${data.suppliers.pending_requests} request terkirim`
          : "Semua aktif",
      tone: "info" as const,
      icon: Building2,
    },
    {
      label: "Selesai bulan ini",
      value: String(data.orders.completed_this_month),
      meta: "order completed",
      tone: "success" as const,
      icon: PackageCheck,
    },
  ];

  return (
    <main className="space-y-8 px-6 py-6 lg:px-8 lg:py-8">
      {/* Header */}
      <section className="flex flex-col gap-4 rounded-3xl border border-[#E2E8F0] bg-white px-6 py-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <Badge tone="info">Distributor dashboard</Badge>
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight text-[#0F172A]">
              Monitor inventory, orders, dan supplier
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-[#64748B]">
              Pantau stok, kelola pesanan ke supplier, dan ambil keputusan restock lebih cepat dengan AI.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/suppliers">
            <Button variant="secondary">Cari supplier</Button>
          </Link>
          <Link href="/dashboard/orders">
            <Button>Buat order</Button>
          </Link>
        </div>
      </section>

      {/* KPIs */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </section>

      {/* AI Insights */}
      {data.ai_insights.length > 0 && (
        <section>
          <InsightCard insights={data.ai_insights} />
        </section>
      )}

      {/* Out of stock alert */}
      {data.inventory.out_of_stock_count > 0 && (
        <section>
          <Card className="rounded-2xl border-red-100 bg-red-50">
            <CardContent className="flex items-center justify-between gap-4 p-5">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-[#EF4444]" />
                <div>
                  <p className="text-sm font-semibold text-[#0F172A]">
                    {data.inventory.out_of_stock_count} item habis stok
                  </p>
                  <p className="text-xs text-[#64748B]">Perlu restock segera.</p>
                </div>
              </div>
              <Link href="/dashboard/inventory?status=out_of_stock">
                <Button variant="secondary" className="shrink-0 text-[#EF4444]">
                  Lihat inventory
                </Button>
              </Link>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Stats grid */}
      <section className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-[#64748B]">Low stock items</p>
            <p className="mt-2 text-3xl font-semibold text-[#0F172A]">
              {data.inventory.low_stock_count}
            </p>
            <Link href="/dashboard/inventory?status=low_stock">
              <p className="mt-2 text-xs font-medium text-[#3B82F6] hover:underline">
                Lihat semua →
              </p>
            </Link>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-[#64748B]">Pending orders</p>
            <p className="mt-2 text-3xl font-semibold text-[#0F172A]">
              {data.orders.pending_orders}
            </p>
            <Link href="/dashboard/orders?status=pending">
              <p className="mt-2 text-xs font-medium text-[#3B82F6] hover:underline">
                Lihat semua →
              </p>
            </Link>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-[#64748B]">Supplier partners</p>
            <p className="mt-2 text-3xl font-semibold text-[#0F172A]">
              {data.suppliers.partner_count}
            </p>
            <Link href="/dashboard/suppliers?type=partner">
              <p className="mt-2 text-xs font-medium text-[#3B82F6] hover:underline">
                Lihat semua →
              </p>
            </Link>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

// ─── Supplier dashboard ───────────────────────────────────────────────────────

function SupplierDashboard({ data }: { data: Extract<DashboardSummary, { role: "supplier" }> }) {
  const isEmpty =
    data.products.total_active === 0 &&
    data.orders.incoming_orders === 0 &&
    data.partners.distributor_count === 0;

  if (isEmpty) return <DashboardEmpty role="supplier" />;

  const kpis = [
    {
      label: "Produk aktif",
      value: String(data.products.total_active),
      meta: `${data.products.low_stock_count} low stock`,
      tone: data.products.low_stock_count > 0 ? ("warning" as const) : ("success" as const),
      icon: Package,
    },
    {
      label: "Incoming orders",
      value: String(data.orders.incoming_orders),
      meta: `${data.orders.processing} sedang diproses`,
      tone: data.orders.incoming_orders > 0 ? ("info" as const) : ("success" as const),
      icon: PackageCheck,
    },
    {
      label: "Distributor partner",
      value: String(data.partners.distributor_count),
      meta:
        data.partners.pending_requests > 0
          ? `${data.partners.pending_requests} request masuk`
          : "Semua aktif",
      tone: data.partners.pending_requests > 0 ? ("warning" as const) : ("success" as const),
      icon: Users,
    },
    {
      label: "Selesai bulan ini",
      value: String(data.orders.completed_this_month),
      meta: "order fulfilled",
      tone: "success" as const,
      icon: Clock3,
    },
  ];

  return (
    <main className="space-y-8 px-6 py-6 lg:px-8 lg:py-8">
      {/* Header */}
      <section className="flex flex-col gap-4 rounded-3xl border border-[#E2E8F0] bg-white px-6 py-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <Badge tone="info">Supplier dashboard</Badge>
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight text-[#0F172A]">
              Monitor produk, orders, dan distributor
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-[#64748B]">
              Pantau stok produk, proses incoming order, dan kelola kemitraan dengan distributor.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/suppliers">
            <Button variant="secondary">Partnership requests</Button>
          </Link>
          <Link href="/dashboard/orders">
            <Button>Lihat orders</Button>
          </Link>
        </div>
      </section>

      {/* KPIs */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </section>

      {/* AI Insights */}
      {data.ai_insights.length > 0 && (
        <section>
          <InsightCard insights={data.ai_insights} />
        </section>
      )}

      {/* Partnership requests alert */}
      {data.partners.pending_requests > 0 && (
        <section>
          <Card className="rounded-2xl border-amber-100 bg-amber-50">
            <CardContent className="flex items-center justify-between gap-4 p-5">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-[#F59E0B]" />
                <div>
                  <p className="text-sm font-semibold text-[#0F172A]">
                    {data.partners.pending_requests} partnership request menunggu
                  </p>
                  <p className="text-xs text-[#64748B]">Tinjau dan respond request dari distributor.</p>
                </div>
              </div>
              <Link href="/dashboard/suppliers">
                <Button variant="secondary" className="shrink-0">
                  Tinjau request
                </Button>
              </Link>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Stats grid */}
      <section className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-[#64748B]">Low stock produk</p>
            <p className="mt-2 text-3xl font-semibold text-[#0F172A]">
              {data.products.low_stock_count}
            </p>
            <Link href="/dashboard/inventory?status=low_stock">
              <p className="mt-2 text-xs font-medium text-[#3B82F6] hover:underline">
                Update stok →
              </p>
            </Link>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-[#64748B]">Sedang diproses</p>
            <p className="mt-2 text-3xl font-semibold text-[#0F172A]">{data.orders.processing}</p>
            <Link href="/dashboard/orders?status=processing">
              <p className="mt-2 text-xs font-medium text-[#3B82F6] hover:underline">
                Lihat orders →
              </p>
            </Link>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-[#64748B]">Distributor partner</p>
            <p className="mt-2 text-3xl font-semibold text-[#0F172A]">
              {data.partners.distributor_count}
            </p>
            <Link href="/dashboard/suppliers">
              <p className="mt-2 text-xs font-medium text-[#3B82F6] hover:underline">
                Lihat semua →
              </p>
            </Link>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data, isLoading, isError, refetch } = useDashboard();
  const role = useAuthStore((s) => s.user?.role) ?? "distributor";

  if (isLoading) return <DashboardLoading />;
  if (isError) return <DashboardError onRetry={() => refetch()} />;
  if (!data) return <DashboardEmpty role={role} />;

  if (data.role === "supplier") {
    return <SupplierDashboard data={data} />;
  }
  return <DistributorDashboard data={data} />;
}
