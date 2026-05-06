"use client";

import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  BarChart3,
  Boxes,
  LineChart,
  Loader2,
  Target,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Package,
  Users,
} from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { PageErrorState } from "@/components/dashboard/page-error-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useRetailerAnalytics,
  useDistributorAnalytics,
  useSupplierAnalytics,
  useProductInsights,
  type DistributorPerformance,
} from "@/hooks/useAnalytics";
import { useAuthStore } from "@/store/useAuthStore";

const SUPPLIER_TABS = ["Revenue", "Demand", "Orders", "Fulfillment"] as const;
type SupplierTab = (typeof SUPPLIER_TABS)[number];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
    notation: "compact",
  }).format(amount);
}

function formatNumber(num: number) {
  return new Intl.NumberFormat("id-ID").format(num);
}

// --- Supplier section ---

function SupplierAnalytics() {
  const { data, isLoading, isError, refetch } = useSupplierAnalytics(true);
  const { data: insights, isLoading: insightsLoading } = useProductInsights(true);
  const [activeTab, setActiveTab] = useState<SupplierTab>("Revenue");

  const summary = data?.summary;
  const trends = data?.trends;
  const distributorPerf = data?.distributor_performance ?? [];

  const activeTrend = useMemo(() => {
    if (!trends) return [];
    switch (activeTab) {
      case "Revenue":
        return trends.revenue ?? [];
      case "Demand":
        return trends.demand ?? [];
      case "Orders":
        return trends.orders ?? [];
      case "Fulfillment":
        return trends.fulfillment ?? [];
      default:
        return [];
    }
  }, [trends, activeTab]);

  const trendMax = useMemo(() => {
    if (!activeTrend || activeTrend.length === 0) return 1;
    return Math.max(...activeTrend.map((t) => t.value));
  }, [activeTrend]);

  const trendLabel = activeTab === "Revenue" ? "Pendapatan" : activeTab === "Demand" ? "Permintaan" : activeTab === "Orders" ? "Pesanan" : "Fulfillment";

  const topSelling = insights?.top_selling ?? [];
  const declining = insights?.declining ?? [];
  const stockRisk = insights?.stock_risk ?? [];

  return (
    <>
      {isError && !isLoading && (
        <section>
          <PageErrorState message="Gagal memuat data analytics" onRetry={() => refetch()} />
        </section>
      )}

      {summary && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Total Revenue"
            value={formatCurrency(summary.total_revenue ?? 0)}
            meta="Pendapatan kotor"
            tone="success"
            icon={LineChart}
          />
          <KpiCard
            label="Demand Growth"
            value={`+${summary.demand_growth_pct ?? 0}%`}
            meta="Pertumbuhan permintaan"
            tone="info"
            icon={TrendingUp}
          />
          <KpiCard
            label="Fulfillment Rate"
            value={`${Math.round((summary.fulfillment_rate ?? 0) * (summary.fulfillment_rate != null && summary.fulfillment_rate <= 1 ? 100 : 1))}%`}
            meta="Pesanan terkirim penuh"
            tone="success"
            icon={Target}
          />
          <KpiCard
            label="Distributor Contribution"
            value={`${summary.active_distributor_contribution_pct ?? 0}%`}
            meta="Kontribusi distributor aktif"
            tone="info"
            icon={Users}
          />
        </section>
      )}

      {!isError && (
        <>
          <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#0F172A]">Financial Trends</h2>
                <div className="flex gap-1 rounded-lg border border-[#E2E8F0] bg-slate-50 p-1">
                  {SUPPLIER_TABS.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        activeTab === tab
                          ? "bg-white text-[#0F172A] shadow-sm"
                          : "text-[#64748B] hover:text-[#0F172A]"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{trendLabel} (4 Minggu Terakhir)</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex h-64 items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-[#94A3B8]" />
                    </div>
                  ) : activeTrend.length === 0 ? (
                    <div className="flex h-64 items-center justify-center">
                      <span className="text-sm text-[#64748B]">Belum ada data.</span>
                    </div>
                  ) : (
                    <div className="relative h-64 w-full">
                      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox={`0 0 ${activeTrend.length * 100} 100`}>
                        <polyline
                          fill="none"
                          stroke="#3B82F6"
                          strokeWidth="2"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                          points={activeTrend
                            .map((t, i) => {
                              const x = i * 100 + 50;
                              const y = 95 - ((trendMax ? t.value / trendMax : 0) * 80);
                              return `${x},${y}`;
                            })
                            .join(" ")}
                        />
                        <polyline
                          fill="url(#areaGradient)"
                          stroke="none"
                          points={`50,95 ${activeTrend
                            .map((t, i) => {
                              const x = i * 100 + 50;
                              const y = 95 - ((trendMax ? t.value / trendMax : 0) * 80);
                              return `${x},${y}`;
                            })
                            .join(" ")} ${(activeTrend.length - 1) * 100 + 50},95`}
                        />
                        <defs>
                          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.15" />
                            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="absolute inset-x-0 bottom-0 flex justify-between px-8">
                        {activeTrend.map((t) => (
                          <span key={t.label} className="text-xs text-[#64748B]">{t.label}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-[#0F172A]">Product Insights</h2>

              {insightsLoading ? (
                <Card className="rounded-2xl">
                  <CardContent className="flex h-64 items-center justify-center pt-6">
                    <Loader2 className="h-5 w-5 animate-spin text-[#94A3B8]" />
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {topSelling.length > 0 && (
                    <Card className="rounded-2xl">
                      <CardHeader className="space-y-1 pb-2">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-emerald-600" />
                          <CardTitle className="text-sm">Top Selling</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2 pt-0">
                        {topSelling.map((p, i) => (
                          <div key={p.item_id ?? p.name ?? i} className="flex items-center justify-between">
                            <span className="text-sm text-[#0F172A]">{p.name}</span>
                            <Badge tone="success">{formatNumber(p.volume)}</Badge>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {declining.length > 0 && (
                    <Card className="rounded-2xl">
                      <CardHeader className="space-y-1 pb-2">
                        <div className="flex items-center gap-2">
                          <TrendingDown className="h-4 w-4 text-rose-500" />
                          <CardTitle className="text-sm">Declining</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2 pt-0">
                        {declining.map((p) => (
                          <div key={p.item_id} className="flex items-center justify-between">
                            <span className="text-sm text-[#0F172A]">{p.name}</span>
                            <Badge tone="danger">{formatNumber(p.volume)}</Badge>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {stockRisk.length > 0 && (
                    <Card className="rounded-2xl">
                      <CardHeader className="space-y-1 pb-2">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                          <CardTitle className="text-sm">Stock Risk</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2 pt-0">
                        {stockRisk.map((p) => (
                          <div key={p.item_id} className="flex items-center justify-between">
                            <span className="text-sm text-[#0F172A]">{p.name}</span>
                            <Badge tone="warning">{p.stock}/{p.min_stock}</Badge>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </div>
          </section>

          {distributorPerf.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-[#0F172A]">Distributor Performance</h2>
              <Card className="rounded-2xl">
                <CardContent className="pt-6">
                  <div className="space-y-0">
                    <div className="grid grid-cols-12 gap-4 border-b border-[#E2E8F0] pb-3 text-xs uppercase tracking-wider text-[#64748B]">
                      <div className="col-span-3">Distributor</div>
                      <div className="col-span-2 text-right">Orders</div>
                      <div className="col-span-3 text-right">Revenue</div>
                      <div className="col-span-3 text-right">Fulfillment</div>
                      <div className="col-span-1 text-right">Score</div>
                    </div>
                    <div className="divide-y divide-[#E2E8F0]">
                      {distributorPerf.map((d) => (
                        <DistributorPerfRow key={d.distributor_id} distributor={d} />
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>
          )}
        </>
      )}
    </>
  );
}

function DistributorPerfRow({ distributor }: { distributor: DistributorPerformance }) {
  return (
    <div className="grid grid-cols-12 items-center gap-4 py-4">
      <div className="col-span-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
          <Users className="h-4 w-4 text-[#3B82F6]" />
        </div>
        <span className="text-sm font-medium text-[#0F172A]">{distributor.name}</span>
      </div>
      <div className="col-span-2 text-right text-sm text-[#0F172A]">
        {distributor.order_volume}
      </div>
      <div className="col-span-3 text-right text-sm font-medium text-[#0F172A]">
        {formatCurrency(distributor.revenue_contribution)}
      </div>
      <div className="col-span-3 text-right">
        <Badge tone={distributor.fulfillment_success_rate >= 0.95 ? "success" : distributor.fulfillment_success_rate >= 0.9 ? "info" : "warning"}>
          {Math.round(distributor.fulfillment_success_rate * 100)}%
        </Badge>
      </div>
      <div className="col-span-1 text-right text-sm font-semibold text-[#0F172A]">
        {distributor.reliability_score}
      </div>
    </div>
  );
}

// --- Distributor / Retailer section ---

function DistributorAnalytics() {
  const { data, isLoading, isError, refetch } = useDistributorAnalytics(true);
  const { data: insights, isLoading: insightsLoading } = useProductInsights(true);
  const summary = data?.summary;
  const trends = useMemo(() => data?.trends ?? [], [data]);

  const trendMax = useMemo(() => {
    if (trends.length === 0) return 1;
    return Math.max(...trends.map((t) => Math.max(t.revenue, t.spending)));
  }, [trends]);

  const topSelling = insights?.top_selling ?? [];

  return (
    <>
      {isError && !isLoading && (
        <section>
          <PageErrorState message="Gagal memuat data analytics" onRetry={() => refetch()} />
        </section>
      )}

      {summary && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <KpiCard
            label="Revenue Growth"
            value={`+${summary.revenue_growth}%`}
            meta="Dibanding bulan lalu"
            tone="success"
            icon={LineChart}
          />
          <KpiCard
            label="Inventory Turnover"
            value={`${summary.inventory_turnover}x`}
            meta="Rata-rata perputaran stok"
            tone="info"
            icon={Boxes}
          />
          <KpiCard
            label="Fulfillment Rate"
            value={`${summary.order_fulfillment_rate}%`}
            meta="Pesanan terkirim penuh"
            tone="success"
            icon={Target}
          />
          <KpiCard
            label="Supplier Perf."
            value={`${summary.partner_performance}/100`}
            meta="Indeks kinerja supplier"
            tone="success"
            icon={BarChart3}
          />
          <KpiCard
            label="Forecast Accuracy"
            value={`${summary.forecast_accuracy}%`}
            meta="Akurasi prediksi demand"
            tone="warning"
            icon={Target}
          />
        </section>
      )}

      {!isError && (
        <section className="grid gap-6 xl:grid-cols-[1fr_0.4fr]">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-[#0F172A]">Financial Trends</h2>

            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base">Revenue vs Spending</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex h-64 items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-[#94A3B8]" />
                  </div>
                ) : (
                  <div className="relative h-64 w-full">
                    <div className="absolute inset-0 flex items-end justify-between px-2 pb-6 pt-4">
                      <div className="absolute inset-x-0 bottom-6 top-4 flex flex-col justify-between border-l border-[#E2E8F0]">
                        <div className="w-full border-b border-dashed border-[#E2E8F0] opacity-50" />
                        <div className="w-full border-b border-dashed border-[#E2E8F0] opacity-50" />
                        <div className="w-full border-b border-dashed border-[#E2E8F0] opacity-50" />
                        <div className="w-full border-b border-dashed border-[#E2E8F0] opacity-50" />
                        <div className="w-full border-b border-[#E2E8F0]" />
                      </div>
                      {trends.map((t) => {
                        const maxVal = trendMax || 1;
                        const revPct = Math.max(5, (t.revenue / maxVal) * 100);
                        const spendPct = Math.max(5, (t.spending / maxVal) * 100);
                        return (
                          <div key={t.label} className="relative z-10 flex h-full flex-col justify-end">
                            <div className="flex w-16 items-end justify-center gap-1">
                              <div className="w-4 rounded-t-sm bg-[#3B82F6] transition-all hover:opacity-80" style={{ height: `${revPct}%` }} title={`Revenue: ${formatCurrency(t.revenue)}`} />
                              <div className="w-4 rounded-t-sm bg-[#F59E0B] transition-all hover:opacity-80" style={{ height: `${spendPct}%` }} title={`Spending: ${formatCurrency(t.spending)}`} />
                            </div>
                            <p className="mt-2 text-center text-xs text-[#64748B]">{t.label}</p>
                          </div>
                        );
                      })}
                    </div>
                    <div className="absolute -top-2 right-0 flex gap-4 text-xs font-medium text-[#64748B]">
                      <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded-full bg-[#3B82F6]" /> Revenue</div>
                      <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded-full bg-[#F59E0B]" /> Spending</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="rounded-2xl">
              <CardHeader className="space-y-1">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-[#3B82F6]" />
                  <CardTitle className="text-base">Top Products</CardTitle>
                </div>
                <p className="text-sm text-[#64748B]">Fast-moving items</p>
              </CardHeader>
              <CardContent>
                {insightsLoading ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-[#94A3B8]" /></div>
                ) : topSelling.length === 0 ? (
                  <p className="text-sm text-[#64748B] text-center">Belum ada data.</p>
                ) : (
                  <div className="space-y-4">
                    {topSelling.map((p) => (
                      <div key={p.item_id} className="flex items-center justify-between border-b border-[#E2E8F0] pb-2 last:border-0 last:pb-0">
                        <div className="flex items-center gap-3">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-[#64748B]">{p.name.charAt(0)}</span>
                          <p className="text-sm font-medium text-[#0F172A]">{p.name}</p>
                        </div>
                        <div className="flex items-center gap-1 text-sm font-semibold text-[#22C55E]">
                          {p.volume} {p.trend === "up" && <ArrowUpRight className="h-3 w-3" />}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      )}
    </>
  );
}

function RetailerAnalytics() {
  const { data, isLoading, isError, refetch } = useRetailerAnalytics(true);
  const { data: insights, isLoading: insightsLoading } = useProductInsights(true);
  const summary = data?.summary;
  const trends = useMemo(() => data?.trends ?? [], [data]);

  const trendMax = useMemo(() => {
    if (trends.length === 0) return 1;
    return Math.max(...trends.map((t) => Math.max(t.revenue, t.spending)));
  }, [trends]);

  const topSelling = insights?.top_selling ?? [];

  return (
    <>
      {isError && !isLoading && (
        <section>
          <PageErrorState message="Gagal memuat data analytics" onRetry={() => refetch()} />
        </section>
      )}

      {summary && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <KpiCard label="Revenue Growth" value={`+${summary.revenue_growth}%`} meta="Dibanding bulan lalu" tone="success" icon={LineChart} />
          <KpiCard label="Inventory Turnover" value={`${summary.inventory_turnover}x`} meta="Rata-rata perputaran stok" tone="info" icon={Boxes} />
          <KpiCard label="Fulfillment Rate" value={`${summary.order_fulfillment_rate}%`} meta="Pesanan terkirim penuh" tone="success" icon={Target} />
          <KpiCard label="Distributor Perf." value={`${summary.partner_performance}/100`} meta="Indeks kinerja distributor" tone="success" icon={BarChart3} />
          <KpiCard label="Forecast Accuracy" value={`${summary.forecast_accuracy}%`} meta="Akurasi prediksi demand" tone="warning" icon={Target} />
        </section>
      )}

      {!isError && (
        <section className="grid gap-6 xl:grid-cols-[1fr_0.4fr]">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-[#0F172A]">Business Performance</h2>
            <Card className="rounded-2xl">
              <CardHeader><CardTitle className="text-base">Revenue vs Spending (6 Bulan Terakhir)</CardTitle></CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex h-64 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-[#94A3B8]" /></div>
                ) : (
                  <div className="relative h-64 w-full">
                    <div className="absolute inset-0 flex items-end justify-between px-2 pb-6 pt-4">
                      <div className="absolute inset-x-0 bottom-6 top-4 flex flex-col justify-between border-l border-[#E2E8F0]">
                        <div className="w-full border-b border-dashed border-[#E2E8F0] opacity-50" />
                        <div className="w-full border-b border-dashed border-[#E2E8F0] opacity-50" />
                        <div className="w-full border-b border-dashed border-[#E2E8F0] opacity-50" />
                        <div className="w-full border-b border-dashed border-[#E2E8F0] opacity-50" />
                        <div className="w-full border-b border-[#E2E8F0]" />
                      </div>
                      {trends.map((t) => {
                        const maxVal = trendMax || 1;
                        const revPct = Math.max(5, (t.revenue / maxVal) * 100);
                        const spendPct = Math.max(5, (t.spending / maxVal) * 100);
                        return (
                          <div key={t.label} className="relative z-10 flex h-full flex-col justify-end">
                            <div className="flex w-16 items-end justify-center gap-1">
                              <div className="w-4 rounded-t-sm bg-[#3B82F6] transition-all hover:opacity-80" style={{ height: `${revPct}%` }} title={`Revenue: ${formatCurrency(t.revenue)}`} />
                              <div className="w-4 rounded-t-sm bg-[#F59E0B] transition-all hover:opacity-80" style={{ height: `${spendPct}%` }} title={`Spending: ${formatCurrency(t.spending)}`} />
                            </div>
                            <p className="mt-2 text-center text-xs text-[#64748B]">{t.label}</p>
                          </div>
                        );
                      })}
                    </div>
                    <div className="absolute -top-2 right-0 flex gap-4 text-xs font-medium text-[#64748B]">
                      <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded-full bg-[#3B82F6]" /> Revenue</div>
                      <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded-full bg-[#F59E0B]" /> Spending</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="rounded-2xl">
              <CardHeader className="space-y-1">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-[#3B82F6]" />
                  <CardTitle className="text-base">Top Products</CardTitle>
                </div>
                <p className="text-sm text-[#64748B]">Fast-moving items</p>
              </CardHeader>
              <CardContent>
                {insightsLoading ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-[#94A3B8]" /></div>
                ) : topSelling.length === 0 ? (
                  <p className="text-sm text-[#64748B] text-center">Belum ada data.</p>
                ) : (
                  <div className="space-y-4">
                    {topSelling.map((p) => (
                      <div key={p.item_id} className="flex items-center justify-between border-b border-[#E2E8F0] pb-2 last:border-0 last:pb-0">
                        <div className="flex items-center gap-3">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-[#64748B]">{p.name.charAt(0)}</span>
                          <p className="text-sm font-medium text-[#0F172A]">{p.name}</p>
                        </div>
                        <div className="flex items-center gap-1 text-sm font-semibold text-[#22C55E]">
                          {p.volume} {p.trend === "up" && <ArrowUpRight className="h-3 w-3" />}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      )}
    </>
  );
}

// --- Main page ---

export default function AnalyticsPage() {
  const role = useAuthStore((s) => s.user?.role);

  if (!role) {
    return (
      <main className="flex h-[80vh] items-center justify-center p-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-[#0F172A]">Akses Ditolak</h2>
          <p className="mt-2 text-sm text-[#64748B]">Silakan login terlebih dahulu.</p>
        </div>
      </main>
    );
  }

  const headerSubtitle = role === "supplier"
    ? "Pendapatan, permintaan, fulfillment, dan kontribusi distributor dari waktu ke waktu."
    : role === "distributor"
      ? "Pendapatan, perputaran stok, kecepatan pengiriman supplier, dan pertumbuhan dari waktu ke waktu."
      : "Pendapatan, perputaran stok, kecepatan pengiriman supplier, dan pertumbuhan dari waktu ke waktu.";

  return (
    <main className="space-y-6 px-6 py-6 lg:px-8 lg:py-8">
      <section className="flex flex-col gap-4 rounded-3xl border border-[#E2E8F0] bg-white px-6 py-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <Badge tone="info">Business intelligence</Badge>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-[#0F172A]">Analytics</h1>
            <p className="max-w-3xl text-sm leading-7 text-[#64748B]">{headerSubtitle}</p>
          </div>
        </div>
      </section>

      {role === "supplier" && <SupplierAnalytics />}
      {role === "distributor" && <DistributorAnalytics />}
      {role === "retailer" && <RetailerAnalytics />}
    </main>
  );
}


