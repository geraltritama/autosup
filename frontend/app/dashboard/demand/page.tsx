"use client";

import { useState } from "react";
import { 
  ArrowDownRight, 
  ArrowUpRight, 
  Loader2, 
  TrendingDown, 
  TrendingUp,
  Users,
  LineChart,
  BarChart3,
  Package,
  PackageCheck
} from "lucide-react";
import { InsightCard } from "@/components/dashboard/insight-card";
import { PageErrorState } from "@/components/dashboard/page-error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendChart } from "@/components/demand/trend-chart";
import { ProductComparisonChart } from "@/components/demand/product-comparison-chart";
import { useDemandIntelligence } from "@/hooks/useDemand";
import { useAuthStore } from "@/store/useAuthStore";

function formatNumber(num: number) {
  return new Intl.NumberFormat("id-ID").format(num);
}

export default function DemandPage() {
  const role = useAuthStore((s) => s.user?.role);
  const [period, setPeriod] = useState<"weekly" | "monthly">("monthly");
  const { data, isLoading, isError, refetch } = useDemandIntelligence(period);

  if (role !== "supplier") {
    return (
      <main className="flex h-[80vh] items-center justify-center p-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-[#0F172A]">Akses Ditolak</h2>
          <p className="mt-2 text-sm text-[#64748B]">Halaman Demand Intelligence khusus untuk Supplier.</p>
        </div>
      </main>
    );
  }

  const trends = data?.trends ?? [];
  const rising = data?.top_rising ?? [];
  const declining = data?.declining ?? [];
  const insights = data?.insights ?? [];
  const topSelling = data?.top_selling ?? [];
  const productPerformance = data?.product_performance_by_distributor ?? [];

  const adaptedInsights = insights.map((i) => ({
    type: i.type,
    message: i.message,
    urgency: i.urgency,
    item_id: i.type,
  }));

  return (
    <main className="space-y-6 px-6 py-6 lg:px-8 lg:py-8">
      {/* Header */}
      <section className="flex flex-col gap-4 rounded-3xl border border-[#E2E8F0] bg-white px-6 py-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <Badge tone="info">Data & Intelligence</Badge>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-[#0F172A]">Demand Intelligence</h1>
            <p className="max-w-3xl text-sm leading-7 text-[#64748B]">
              Analisis tren permintaan produk secara keseluruhan untuk membantu perencanaan produksi dan inventory yang lebih efisien.
            </p>
          </div>
        </div>
        <div className="flex rounded-lg border border-[#E2E8F0] bg-slate-50 p-1">
          <button
            onClick={() => setPeriod("weekly")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              period === "weekly" ? "bg-white text-[#0F172A] shadow-sm" : "text-[#64748B] hover:text-[#0F172A]"
            }`}
          >
            Weekly
          </button>
          <button
            onClick={() => setPeriod("monthly")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              period === "monthly" ? "bg-white text-[#0F172A] shadow-sm" : "text-[#64748B] hover:text-[#0F172A]"
            }`}
          >
            Monthly
          </button>
        </div>
      </section>

      {/* AI Insights */}
      {adaptedInsights.length > 0 && (
        <section>
          <InsightCard insights={adaptedInsights} />
        </section>
      )}

      {/* Error state */}
      {isError && !isLoading && (
        <section>
          <PageErrorState message="Gagal memuat data demand intelligence" onRetry={() => refetch()} />
        </section>
      )}

      {/* Main content */}
      {!isError && (
      <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          {/* Demand Trend Chart */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <LineChart className="h-5 w-5 text-[#2563EB]" />
              <h2 className="text-lg font-semibold text-[#0F172A]">Overall Demand Trend</h2>
            </div>

            <Card className="rounded-2xl">
              <CardContent className="pt-6">
                {isLoading ? (
                  <div className="flex h-[300px] items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-[#94A3B8]" />
                  </div>
                ) : (
                  <TrendChart data={trends} period={period} />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Product Performance by Distributor */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-[#2563EB]" />
              <h2 className="text-lg font-semibold text-[#0F172A]">Product Performance by Distributor</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {productPerformance.map((dist) => (
                <Card key={dist.distributor_id} className="rounded-2xl">
                  <CardHeader className="space-y-1 pb-3">
                    <CardTitle className="text-sm font-semibold text-[#0F172A]">{dist.distributor_name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {dist.products.slice(0, 3).map((prod, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span className="truncate text-[#64748B] flex-1">{prod.product_name}</span>
                        <span className="font-medium text-[#0F172A]">{formatNumber(prod.quantity)} unit</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-[#0F172A]">Product Performance</h2>
          
          <Card className="rounded-2xl">
            <CardHeader className="space-y-1 pb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[#22C55E]" />
                <CardTitle className="text-base">Top Rising Demand</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-[#94A3B8]" />
                </div>
              ) : rising.length === 0 ? (
                <p className="text-sm text-[#64748B]">Tidak ada data.</p>
              ) : (
                <div className="space-y-3">
                  {rising.slice(0, 4).map((p) => {
                    const maxDemand = Math.max(...rising.map((r) => r.current_demand));
                    const barWidth = (p.current_demand / maxDemand) * 100;
                    return (
                      <div key={p.id} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-[#0F172A] truncate flex-1">{p.name}</span>
                          <span className="text-xs text-[#64748B] ml-2">{formatNumber(p.current_demand)}</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div 
                            className="h-full rounded-full bg-[#22C55E] transition-all"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge tone="success" className="text-[10px] py-0 h-5">
                            +{p.growth_pct}%
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="space-y-1 pb-4">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-[#EF4444]" />
                <CardTitle className="text-base">Declining Demand</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-[#94A3B8]" />
                </div>
              ) : declining.length === 0 ? (
                <p className="text-sm text-[#64748B]">Tidak ada data.</p>
              ) : (
                <div className="space-y-3">
                  {declining.slice(0, 4).map((p) => {
                    const maxDemand = Math.max(...declining.map((d) => d.current_demand));
                    const barWidth = (p.current_demand / maxDemand) * 100;
                    return (
                      <div key={p.id} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-[#0F172A] truncate flex-1">{p.name}</span>
                          <span className="text-xs text-[#64748B] ml-2">{formatNumber(p.current_demand)}</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div 
                            className="h-full rounded-full bg-[#EF4444] transition-all"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge tone="danger" className="text-[10px] py-0 h-5">
                            {Math.abs(p.growth_pct)}%
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Selling Products */}
          <Card className="rounded-2xl">
            <CardHeader className="space-y-1 pb-4">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-[#2563EB]" />
                <CardTitle className="text-base">Most Ordered by Distributor</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-[#94A3B8]" />
                </div>
              ) : topSelling.length === 0 ? (
                <p className="text-sm text-[#64748B]">Tidak ada data.</p>
              ) : (
                <div className="space-y-3">
                  {topSelling.map((p, idx) => (
                    <div key={p.id} className="flex items-center gap-3 border-b border-[#E2E8F0] pb-2 last:border-0 last:pb-0">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#EFF6FF] text-xs font-semibold text-[#2563EB]">
                        {idx + 1}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[#0F172A]">{p.name}</p>
                        <p className="text-xs text-[#64748B]">{p.category}</p>
                      </div>
                      <p className="text-sm font-semibold text-[#0F172A]">{formatNumber(p.current_demand)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
      )}
    </main>
  );
}
