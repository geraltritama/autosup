"use client";

import Link from "next/link";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertCircle,
  Boxes,
  Building2,
  Check,
  Clock3,
  CreditCard,
  Package,
  PackageCheck,
  RefreshCw,
  ShoppingBag,
  ShoppingCart,
  Target,
  Truck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useDashboard, type DashboardSummary } from "@/hooks/useDashboard";
import { useUpdateOrderStatus } from "@/hooks/useOrders";
import { InsightCard } from "@/components/dashboard/insight-card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRupiah(amount: number): string {
  if (amount >= 1_000_000) {
    return `Rp ${(amount / 1_000_000).toFixed(1)}jt`;
  }
  return `Rp ${amount.toLocaleString("en-US")}`;
}

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
        <p className="font-semibold text-[#0F172A]">Failed to load dashboard</p>
        <p className="text-sm text-[#64748B]">Check your connection and try again.</p>
      </div>
      <Button variant="secondary" onClick={onRetry} className="gap-2">
        <RefreshCw className="h-4 w-4" />
        Try again
      </Button>
    </main>
  );
}

// ─── Distributor dashboard ────────────────────────────────────────────────────

function DistributorDashboard({ data }: { data: Extract<DashboardSummary, { role: "distributor" }> }) {
  const updateStatus = useUpdateOrderStatus();
  const kpis = [
    {
      label: "Total inventory",
      value: String(data.inventory.total_items),
      meta: `${data.inventory.low_stock_count} low stock`,
      tone: data.inventory.low_stock_count > 0 ? ("warning" as const) : ("success" as const),
      icon: Boxes,
    },
    {
      label: "Active orders",
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
          ? `${data.suppliers.pending_requests} requests sent`
          : "All active",
      tone: "info" as const,
      icon: Building2,
    },
    {
      label: "Retailer partner",
      value: String(data.retailers.partner_count),
      meta:
        data.retailers.pending_requests > 0
          ? `${data.retailers.pending_requests} requests received`
          : "All active",
      tone: "info" as const,
      icon: Users,
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
              Monitor inventory, orders, and partners
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-[#64748B]">
              Track stock, manage orders to suppliers and from retailers, and make faster restock decisions with AI.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/suppliers">
            <Button variant="secondary">Find suppliers</Button>
          </Link>
          <Link href="/dashboard/retailers">
            <Button variant="secondary">Manage retailers</Button>
          </Link>
          <Link href="/dashboard/orders">
            <Button>Create Order</Button>
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

      {/* Revenue & Spending */}
      {data.financials && (
        <section className="grid gap-4 md:grid-cols-3">
          <Card className="rounded-2xl">
            <CardContent className="p-5">
              <p className="text-[10px] uppercase tracking-wider text-[#64748B]">Revenue (from retailers)</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">
                Rp {(data.financials.revenue || 0).toLocaleString("id-ID")}
              </p>
              <p className="mt-1 text-xs text-[#94A3B8]">This month: Rp {(data.financials.monthly_revenue || 0).toLocaleString("id-ID")}</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl">
            <CardContent className="p-5">
              <p className="text-[10px] uppercase tracking-wider text-[#64748B]">Spending (to suppliers)</p>
              <p className="mt-1 text-2xl font-bold text-[#0F172A]">
                Rp {(data.financials.spending || 0).toLocaleString("id-ID")}
              </p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl">
            <CardContent className="p-5">
              <p className="text-[10px] uppercase tracking-wider text-[#64748B]">Net Margin</p>
              <p className={`mt-1 text-2xl font-bold ${(data.financials.net_margin || 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                Rp {(data.financials.net_margin || 0).toLocaleString("id-ID")}
              </p>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Incoming Orders from Retailers */}
      {(data.pending_incoming ?? []).length > 0 && (
        <section>
          <Card className="rounded-2xl">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs uppercase tracking-[0.18em] text-[#64748B]">Incoming Orders (Pending)</p>
                <Link href="/dashboard/orders?role=seller">
                  <span className="text-xs font-medium text-[#3B82F6] hover:underline">View all →</span>
                </Link>
              </div>
              <div className="max-h-[240px] overflow-y-auto space-y-2 pr-1">
                {(data.pending_incoming ?? []).map((o) => (
                  <div key={o.order_id} className="flex items-center justify-between gap-2 rounded-lg border border-[#E2E8F0] px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#0F172A] truncate">{o.buyer_name || "Retailer"}</p>
                      <p className="text-[10px] text-[#94A3B8]">Rp {o.total.toLocaleString("id-ID")} · {new Date(o.created_at).toLocaleDateString("en-US", { day: "numeric", month: "short" })}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => updateStatus.mutate({ orderId: o.order_id, status: "processing" })}
                        disabled={updateStatus.isPending}
                        className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition"
                        title="Approve"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => updateStatus.mutate({ orderId: o.order_id, status: "cancelled" })}
                        disabled={updateStatus.isPending}
                        className="flex h-7 w-7 items-center justify-center rounded-md bg-rose-50 text-rose-600 hover:bg-rose-100 transition"
                        title="Reject"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
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
                    {data.inventory.out_of_stock_count} items out of stock
                  </p>
                  <p className="text-xs text-[#64748B]">Needs restock immediately.</p>
                </div>
              </div>
              <Link href="/dashboard/inventory?status=out_of_stock">
                <Button variant="secondary" className="shrink-0 text-[#EF4444]">
                  View inventory
                </Button>
              </Link>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Stats grid */}
      <section className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-[#64748B]">Low stock items</p>
            <p className="mt-2 text-3xl font-semibold text-[#0F172A]">
              {data.inventory.low_stock_count}
            </p>
            <Link href="/dashboard/inventory?status=low_stock">
              <p className="mt-2 text-xs font-medium text-[#3B82F6] hover:underline">
                View all →
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
                View all →
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
                View all →
              </p>
            </Link>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-[#64748B]">Retailer partners</p>
            <p className="mt-2 text-3xl font-semibold text-[#0F172A]">
              {data.retailers.partner_count}
            </p>
            <Link href="/dashboard/retailers">
              <p className="mt-2 text-xs font-medium text-[#3B82F6] hover:underline">
                View all →
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
  const updateStatus = useUpdateOrderStatus();

  const kpis = [
    {
      label: "Active products",
      value: String(data.products.total_active),
      meta: `${data.products.low_stock_count} low stock · ${data.products.out_of_stock_count} out`,
      tone: data.products.out_of_stock_count > 0 ? ("danger" as const) : data.products.low_stock_count > 0 ? ("warning" as const) : ("success" as const),
      icon: Package,
    },
    {
      label: "Incoming orders",
      value: String(data.orders.incoming_orders),
      meta: `${data.orders.processing} processing`,
      tone: data.orders.incoming_orders > 0 ? ("info" as const) : ("success" as const),
      icon: PackageCheck,
    },
    {
      label: "Demand growth",
      value: `${(data.demand_growth ?? 0) >= 0 ? "+" : ""}${data.demand_growth ?? 0}%`,
      meta: "vs last week",
      tone: (data.demand_growth ?? 0) > 0 ? ("success" as const) : (data.demand_growth ?? 0) < 0 ? ("danger" as const) : ("info" as const),
      icon: Target,
    },
    {
      label: "Distributor partner",
      value: String(data.partners.distributor_count),
      meta:
        data.partners.pending_requests > 0
          ? `${data.partners.pending_requests} requests received`
          : "All active",
      tone: data.partners.pending_requests > 0 ? ("warning" as const) : ("success" as const),
      icon: Users,
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
              Monitor products, orders, and distributors
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-[#64748B]">
              Monitor product stock, process incoming orders, and manage partnerships with distributors.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/distributors">
            <Button variant="secondary">Partnership requests</Button>
          </Link>
          <Link href="/dashboard/orders">
            <Button>View orders</Button>
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
                    {data.partners.pending_requests} partnership requests pending
                  </p>
                  <p className="text-xs text-[#64748B]">Review and respond to requests from distributors.</p>
                </div>
              </div>
<Link href="/dashboard/distributors">
                <Button variant="secondary" className="shrink-0">
                  Review requests
                </Button>
              </Link>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Top Products + Recent Orders */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Top Products */}
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-[#64748B]">Top Products by Demand</p>
            {(data.top_products ?? []).length > 0 ? (
              <div className="mt-3 space-y-2">
                {(data.top_products ?? []).map((p, i) => (
                  <div key={p.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-[#94A3B8]">{i + 1}</span>
                      <span className="text-sm font-medium text-[#0F172A]">{p.name}</span>
                    </div>
                    <Badge tone={i === 0 ? "success" : "info"} className="text-[10px]">
                      {p.volume} units
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-[#94A3B8]">No order data yet</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Incoming Orders */}
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.18em] text-[#64748B]">Incoming Orders</p>
              <Link href="/dashboard/orders">
                <span className="text-xs font-medium text-[#3B82F6] hover:underline">View all →</span>
              </Link>
            </div>
            {(data.recent_orders ?? []).length > 0 ? (
              <div className="mt-3 max-h-[280px] overflow-y-auto space-y-2 pr-1">
                {(data.recent_orders ?? []).map((o) => (
                  <div key={o.order_id} className="flex items-center justify-between gap-2 rounded-lg border border-[#E2E8F0] px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#0F172A] truncate">{o.buyer_name || "Distributor"}</p>
                      <p className="text-[10px] text-[#94A3B8]">{new Date(o.created_at).toLocaleDateString("en-US", { day: "numeric", month: "short" })}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => updateStatus.mutate({ orderId: o.order_id, status: "processing" })}
                        disabled={updateStatus.isPending}
                        className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition"
                        title="Approve"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => updateStatus.mutate({ orderId: o.order_id, status: "cancelled" })}
                        disabled={updateStatus.isPending}
                        className="flex h-7 w-7 items-center justify-center rounded-md bg-rose-50 text-rose-600 hover:bg-rose-100 transition"
                        title="Reject"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-[#94A3B8]">No pending orders</p>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Demand Trend + Distributor Activity */}
      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        {/* Demand Trend Chart */}
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-[#64748B]">Demand Trend (Weekly)</p>
            {(data.demand_trend_chart ?? []).length > 0 ? (
              <div className="mt-3 h-[200px] min-h-[200px]">
                <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                  <AreaChart data={data.demand_trend_chart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#94A3B8" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="value" stroke="#3B82F6" fill="#DBEAFE" strokeWidth={2} name="Orders" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="mt-3 text-sm text-[#94A3B8]">Not enough data for trend chart</p>
            )}
          </CardContent>
        </Card>

        {/* Distributor Activity Feed */}
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-[#64748B]">Distributor Activity</p>
            {(data.distributor_activity ?? []).length > 0 ? (
              <div className="mt-3 space-y-3">
                {(data.distributor_activity ?? []).map((a, i) => (
                  <div key={i} className="relative pl-4 border-l-2 border-[#E2E8F0]">
                    <div className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-[#3B82F6]" />
                    <p className="text-xs text-[#0F172A]">{a.event}</p>
                    <p className="text-[10px] text-[#94A3B8]">
                      {a.timestamp ? new Date(a.timestamp).toLocaleDateString("en-US", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-[#94A3B8]">No recent activity</p>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Stats grid */}
      <section className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-[#64748B]">Low stock products</p>
            <p className="mt-2 text-3xl font-semibold text-[#0F172A]">
              {data.products.low_stock_count}
            </p>
            <Link href="/dashboard/inventory?status=low_stock">
              <p className="mt-2 text-xs font-medium text-[#3B82F6] hover:underline">
                Update stock →
              </p>
            </Link>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-[#64748B]">Processing</p>
            <p className="mt-2 text-3xl font-semibold text-[#0F172A]">{data.orders.processing}</p>
            <Link href="/dashboard/orders?status=processing">
              <p className="mt-2 text-xs font-medium text-[#3B82F6] hover:underline">
                View orders →
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
            <Link href="/dashboard/distributors">
              <p className="mt-2 text-xs font-medium text-[#3B82F6] hover:underline">
                View all →
              </p>
            </Link>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

// ─── Retailer dashboard ───────────────────────────────────────────────────────

function RetailerDashboard({ data }: { data: Extract<DashboardSummary, { role: "retailer" }> }) {
  const kpis = [
    {
      label: "Total inventory",
      value: String(data.inventory.total_items),
      meta: `${data.inventory.low_stock_count} low stock`,
      tone: data.inventory.low_stock_count > 0 ? ("warning" as const) : ("success" as const),
      icon: ShoppingBag,
    },
    {
      label: "Active orders",
      value: String(data.orders.active_orders),
      meta: `${data.orders.in_transit} in transit`,
      tone: data.orders.active_orders > 0 ? ("info" as const) : ("success" as const),
      icon: Truck,
    },
    {
      label: "Monthly spending",
      value: formatRupiah(data.spending.monthly_spending),
      meta: `${formatRupiah(data.spending.available_credit)} credit available`,
      tone: data.spending.available_credit > 0 ? ("success" as const) : ("danger" as const),
      icon: CreditCard,
    },
    {
      label: "Demand Stability",
      value: `${data.forecast_accuracy_pct}%`,
      meta: `${data.distributors.active_partnered} active distributors`,
      tone: data.forecast_accuracy_pct >= 80 ? ("success" as const) : ("warning" as const),
      icon: Target,
    },
  ];

  return (
    <main className="space-y-8 px-6 py-6 lg:px-8 lg:py-8">
      {/* Header */}
      <section className="flex flex-col gap-4 rounded-3xl border border-[#E2E8F0] bg-white px-6 py-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <Badge tone="info">Retailer dashboard</Badge>
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight text-[#0F172A]">
              Control your business operations
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-[#64748B]">
              Monitor stock, orders to distributors, monthly spending, and AI recommendations for a more efficient business.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/distributors">
            <Button variant="secondary">Find distributors</Button>
          </Link>
          <Link href="/dashboard/orders">
            <Button>Create Order</Button>
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

      {/* Critical alerts row */}
      <section className="grid gap-4 md:grid-cols-2">
        {/* Out of stock alert */}
        {data.inventory.out_of_stock_count > 0 && (
          <Card className="rounded-2xl border-red-100 bg-red-50">
            <CardContent className="flex items-center justify-between gap-4 p-5">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-[#EF4444]" />
                <div>
                  <p className="text-sm font-semibold text-[#0F172A]">
                    {data.inventory.out_of_stock_count} items out of stock
                  </p>
                  <p className="text-xs text-[#64748B]">Operational stock needs to be replenished soon.</p>
                </div>
              </div>
              <Link href="/dashboard/inventory?status=out_of_stock">
                <Button variant="secondary" className="shrink-0 text-[#EF4444]">
                  View inventory
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Upcoming due payments */}
        {data.spending.upcoming_due_payments > 0 && (
          <Card className="rounded-2xl border-amber-100 bg-amber-50">
            <CardContent className="flex items-center justify-between gap-4 p-5">
              <div className="flex items-center gap-3">
                <Wallet className="h-5 w-5 text-[#F59E0B]" />
                <div>
                  <p className="text-sm font-semibold text-[#0F172A]">
                    {data.spending.upcoming_due_payments} payments due soon
                  </p>
                  <p className="text-xs text-[#64748B]">
                    Total outstanding: {formatRupiah(data.spending.total_outstanding)}
                  </p>
                </div>
              </div>
              <Link href="/dashboard/payment">
                <Button variant="secondary" className="shrink-0">
                  View payment
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Stats grid */}
      <section className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-[#64748B]">Low stock</p>
            <p className="mt-2 text-3xl font-semibold text-[#0F172A]">
              {data.inventory.low_stock_count}
            </p>
            <Link href="/dashboard/inventory?status=low_stock">
              <p className="mt-2 text-xs font-medium text-[#3B82F6] hover:underline">
                Restock →
              </p>
            </Link>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-[#64748B]">In transit</p>
            <p className="mt-2 text-3xl font-semibold text-[#0F172A]">{data.orders.in_transit}</p>
            <Link href="/dashboard/orders?status=shipping">
              <p className="mt-2 text-xs font-medium text-[#3B82F6] hover:underline">
                Track →
              </p>
            </Link>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-[#64748B]">Reliability distributor</p>
            <p className="mt-2 text-3xl font-semibold text-[#0F172A]">
              {data.distributors.average_reliability_score}
              <span className="text-base font-normal text-[#64748B]">/100</span>
            </p>
            <Link href="/dashboard/distributors">
              <p className="mt-2 text-xs font-medium text-[#3B82F6] hover:underline">
                View distributors →
              </p>
            </Link>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-[#64748B]">Payment rate</p>
            <p className="mt-2 text-3xl font-semibold text-[#0F172A]">
              {data.spending.payment_success_rate}
              <span className="text-base font-normal text-[#64748B]">%</span>
            </p>
            <Link href="/dashboard/payment">
              <p className="mt-2 text-xs font-medium text-[#3B82F6] hover:underline">
                View payment →
              </p>
            </Link>
          </CardContent>
        </Card>
      </section>

      {/* Spending snapshot */}
      <section>
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B]">
              Spending snapshot
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="space-y-1">
                <p className="text-xs text-[#94A3B8]">Monthly spending</p>
                <p className="text-xl font-semibold text-[#0F172A]">
                  {formatRupiah(data.spending.monthly_spending)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-[#94A3B8]">Total outstanding</p>
                <p className="text-xl font-semibold text-[#EF4444]">
                  {formatRupiah(data.spending.total_outstanding)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-[#94A3B8]">Credit available</p>
                <p className="text-xl font-semibold text-[#22C55E]">
                  {formatRupiah(data.spending.available_credit)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data, isLoading, isError, refetch } = useDashboard();

  if (isLoading) return <DashboardLoading />;
  if (isError) return <DashboardError onRetry={() => refetch()} />;

  if (data?.role === "supplier") return <SupplierDashboard data={data} />;
  if (data?.role === "retailer") return <RetailerDashboard data={data} />;
  if (data) return <DistributorDashboard data={data} />;
  return <DashboardLoading />;
}
