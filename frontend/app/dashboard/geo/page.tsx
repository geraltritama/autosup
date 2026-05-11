"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  MapPin,
  Flame,
  TrendingUp,
  TrendingDown,
  Loader2,
  Filter,
  MapIcon,
} from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { PageErrorState } from "@/components/dashboard/page-error-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGeoDemand } from "@/hooks/useGeoDemand";
import { useInventory } from "@/hooks/useInventory";
import { useAuthStore } from "@/store/useAuthStore";

const DemandMap = dynamic(() => import("@/components/geo/demand-map").then((m) => m.DemandMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-[450px] items-center justify-center rounded-2xl bg-slate-50">
      <Loader2 className="h-5 w-5 animate-spin text-[#94A3B8]" />
    </div>
  ),
});

export default function GeoMappingPage() {
  const role = useAuthStore((s) => s.user?.role);
  const [selectedItemId, setSelectedItemId] = useState<string | undefined>(
    undefined,
  );
  const [selectedRegion, setSelectedRegion] = useState<string | undefined>(
    undefined,
  );

  const {
    data: geoData,
    isLoading: geoLoading,
    isError: geoError,
    refetch,
  } = useGeoDemand(selectedItemId);

  const { data: inventoryData } = useInventory({ limit: 100 });

  const productOptions = useMemo(() => {
    const items = inventoryData?.items;
    if (!items) return [];
    const seen = new Map<string, { id: string; name: string }>();
    for (const item of items) {
      if (!seen.has(item.name)) {
        seen.set(item.name, { id: item.name, name: item.name });
      }
    }
    return Array.from(seen.values());
  }, [inventoryData]);

  const regions = useMemo(() => geoData?.regions ?? [], [geoData]);

  const sortedRegions = useMemo(
    () => [...regions].sort((a, b) => b.demand_score - a.demand_score),
    [regions],
  );

  const computedKpis = useMemo(() => {
    if (regions.length === 0)
      return { totalRegions: 0, topGrowthRegion: "-", highestDemandRegion: "-" };
    const topGrowth = regions.reduce((best, r) =>
      r.growth_pct > best.growth_pct ? r : best,
    );
    const highestDemand = regions.reduce((best, r) =>
      r.demand_score > best.demand_score ? r : best,
    );
    return {
      totalRegions: regions.length,
      topGrowthRegion: topGrowth.region,
      highestDemandRegion: highestDemand.region,
    };
  }, [regions]);

  const selectedRegionData = useMemo(
    () => regions.find((r) => r.region === selectedRegion),
    [regions, selectedRegion],
  );

  if (role !== "supplier") {
    return (
      <main className="flex h-[80vh] items-center justify-center p-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-[#0F172A]">Access Denied</h2>
          <p className="mt-2 text-sm text-[#64748B]">
            Geo Mapping page is for Suppliers only.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-6 px-6 py-6 lg:px-8 lg:py-8">
      <section className="flex flex-col gap-4 rounded-3xl border border-[#E2E8F0] bg-white px-6 py-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <Badge tone="info">Regional Analytics</Badge>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-[#0F172A]">
              Distributor Demand by Region
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-[#64748B]">
              Demand distribution from the distributor network based on geographic regions.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-3">
            <Filter className="h-4 w-4 text-[#64748B]" />
            <select
              value={selectedItemId ?? "all"}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedItemId(val === "all" ? undefined : val);
                setSelectedRegion(undefined);
              }}
              className="h-11 bg-transparent text-sm text-[#0F172A] outline-none"
            >
              <option value="all">All Products</option>
              {productOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {geoData && (
        <section className="grid gap-4 md:grid-cols-3">
          <KpiCard
            label="Total Active Regions"
            value={String(computedKpis.totalRegions)}
            meta="Regions with distributor demand"
            tone="info"
            icon={MapIcon}
          />
          <KpiCard
            label="Highest Growth Region"
            value={computedKpis.topGrowthRegion}
            meta="Highest demand growth"
            tone="success"
            icon={TrendingUp}
          />
          <KpiCard
            label="Highest Demand Score"
            value={computedKpis.highestDemandRegion}
            meta="Regions with highest demand score"
            tone="info"
            icon={Flame}
          />
        </section>
      )}

      {geoError && !geoLoading && (
        <section>
          <PageErrorState
            message="Failed to load regional demand data"
            onRetry={() => refetch()}
          />
        </section>
      )}

      {!geoError && (
        <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-[#0F172A]">
              Demand Heatmap
            </h2>

            {geoLoading ? (
              <Card className="rounded-2xl">
                <CardContent className="flex h-[450px] items-center justify-center pt-6">
                  <Loader2 className="h-5 w-5 animate-spin text-[#94A3B8]" />
                </CardContent>
              </Card>
            ) : regions.length === 0 ? (
              <Card className="rounded-2xl">
                <CardContent className="flex h-[450px] flex-col items-center justify-center pt-6">
                  <MapPin className="mb-3 h-10 w-10 text-[#CBD5E1]" />
                  <p className="text-sm text-[#64748B]">
                    No regional demand data yet.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <DemandMap
                regions={regions}
                selectedRegion={selectedRegion}
                onSelectRegion={setSelectedRegion}
              />
            )}
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-[#0F172A]">
              Region Detail
            </h2>

            {selectedRegionData ? (
              <Card className="rounded-2xl">
                <CardHeader className="border-b border-[#E2E8F0] pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {selectedRegionData.region}
                    </CardTitle>
                    <Badge
                      tone={selectedRegionData.growth_pct >= 0 ? "success" : "danger"}
                      className="gap-0.5"
                    >
                      {selectedRegionData.growth_pct >= 0 ? "+" : ""}
                      {selectedRegionData.growth_pct}%
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div>
                    <p className="text-xs text-[#64748B]">Demand Score</p>
                    <p className="text-3xl font-bold tracking-tight text-[#0F172A]">
                      {selectedRegionData.demand_score}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#64748B]">Pertumbuhan</p>
                    <div className="flex items-center gap-2">
                      {selectedRegionData.growth_pct >= 0 ? (
                        <TrendingUp className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-rose-600" />
                      )}
                      <span
                        className={`text-lg font-semibold ${selectedRegionData.growth_pct >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                      >
                        {selectedRegionData.growth_pct >= 0 ? "+" : ""}
                        {selectedRegionData.growth_pct}%
                      </span>
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <p className="text-xs text-[#64748B]">
                      Data based on orders from partner distributors.
                    </p>
                  </div>
                  {selectedRegionData.distributor_count != null && (
                    <div>
                      <p className="text-xs text-[#64748B]">Active Distributors</p>
                      <p className="text-lg font-semibold text-[#0F172A]">{selectedRegionData.distributor_count}</p>
                    </div>
                  )}
                  {(selectedRegionData.top_products ?? []).length > 0 && (
                    <div>
                      <p className="text-xs text-[#64748B] mb-1">Top Products</p>
                      <div className="space-y-1">
                        {(selectedRegionData.top_products ?? []).map((p) => (
                          <div key={p.name} className="flex items-center justify-between text-xs">
                            <span className="text-[#0F172A]">{p.name}</span>
                            <span className="text-[#64748B]">{p.qty} units</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="rounded-2xl">
                <CardContent className="flex h-[200px] flex-col items-center justify-center pt-6">
                  <MapPin className="mb-3 h-8 w-8 text-[#CBD5E1]" />
                  <p className="text-sm text-[#64748B]">
                    Select a region on the heatmap to view details.
                  </p>
                </CardContent>
              </Card>
            )}

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-[#0F172A]">
                Demand Ranking
              </h3>
              {geoLoading ? (
                <div className="flex h-[200px] items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-[#94A3B8]" />
                </div>
              ) : sortedRegions.length === 0 ? (
                <p className="py-4 text-center text-sm text-[#64748B]">
                  No data yet.
                </p>
              ) : (
                <Card className="rounded-2xl">
                  <CardContent className="pt-4">
                    <div className="space-y-0">
                      <div className="grid grid-cols-12 gap-4 border-b border-[#E2E8F0] pb-3 text-xs uppercase tracking-wider text-[#64748B]">
                        <div className="col-span-1">#</div>
                        <div className="col-span-5">Region</div>
                        <div className="col-span-3 text-right">Demand Score</div>
                        <div className="col-span-3 text-right">Pertumbuhan</div>
                      </div>

                      <div className="divide-y divide-[#E2E8F0]">
                        {sortedRegions.map((r, i) => (
                          <button
                            key={r.region}
                            type="button"
                            onClick={() =>
                              setSelectedRegion((prev) =>
                                prev === r.region ? undefined : r.region,
                              )
                            }
                            className={`grid w-full grid-cols-12 items-center gap-4 py-3 text-left transition-colors hover:bg-slate-50/50 ${selectedRegion === r.region ? "bg-blue-50/50" : ""}`}
                          >
                            <div className="col-span-1 text-xs font-medium text-[#64748B]">
                              {i + 1}
                            </div>
                            <div className="col-span-5 flex items-center gap-2">
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[#3B82F6]">
                                <MapPin className="h-3.5 w-3.5" />
                              </div>
                              <span className="text-sm font-medium text-[#0F172A]">
                                {r.region}
                              </span>
                            </div>
                            <div className="col-span-3 text-right">
                              <span className="text-sm font-semibold text-[#0F172A]">
                                {r.demand_score}
                              </span>
                            </div>
                            <div className="col-span-3 text-right">
                              <Badge
                                tone={r.growth_pct >= 0 ? "success" : "danger"}
                                className="ml-auto w-fit"
                              >
                                {r.growth_pct >= 0 ? "+" : ""}
                                {r.growth_pct}%
                              </Badge>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}