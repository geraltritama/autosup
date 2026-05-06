"use client";

import { useMemo, useState } from "react";
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

function getHeatColor(demandScore: number, min: number, max: number): string {
  if (max === min) return "bg-blue-400";
  const ratio = (demandScore - min) / (max - min);
  if (ratio >= 0.8) return "bg-blue-600 text-white";
  if (ratio >= 0.6) return "bg-blue-500 text-white";
  if (ratio >= 0.4) return "bg-blue-400 text-[#0F172A]";
  if (ratio >= 0.2) return "bg-blue-300 text-[#0F172A]";
  return "bg-blue-100 text-[#0F172A]";
}

function getHeatBorder(demandScore: number, min: number, max: number): string {
  if (max === min) return "border-blue-400";
  const ratio = (demandScore - min) / (max - min);
  if (ratio >= 0.8) return "border-blue-600";
  if (ratio >= 0.6) return "border-blue-500";
  if (ratio >= 0.4) return "border-blue-400";
  if (ratio >= 0.2) return "border-blue-300";
  return "border-blue-200";
}

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
      if (!seen.has(item.id)) {
        seen.set(item.id, { id: item.id, name: item.name });
      }
    }
    return Array.from(seen.values());
  }, [inventoryData]);

  const regions = useMemo(() => geoData?.regions ?? [], [geoData]);

  const minScore = useMemo(
    () => (regions.length > 0 ? Math.min(...regions.map((r) => r.demand_score)) : 0),
    [regions],
  );
  const maxScore = useMemo(
    () => (regions.length > 0 ? Math.max(...regions.map((r) => r.demand_score)) : 100),
    [regions],
  );

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
          <h2 className="text-xl font-semibold text-[#0F172A]">Akses Ditolak</h2>
          <p className="mt-2 text-sm text-[#64748B]">
            Halaman Geo Mapping khusus untuk Supplier.
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
              Permintaan Distributor per Wilayah
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-[#64748B]">
              Distribusi permintaan dari jaringan distributor berdasarkan wilayah geografis.
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
              <option value="all">Semua Produk</option>
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
            label="Total Wilayah Aktif"
            value={String(computedKpis.totalRegions)}
            meta="Wilayah dengan permintaan distributor"
            tone="info"
            icon={MapIcon}
          />
          <KpiCard
            label="Wilayah Tumbuh Tertinggi"
            value={computedKpis.topGrowthRegion}
            meta="Pertumbuhan permintaan tertinggi"
            tone="success"
            icon={TrendingUp}
          />
          <KpiCard
            label="Demand Score Tertinggi"
            value={computedKpis.highestDemandRegion}
            meta="Wilayah dengan skor demand tertinggi"
            tone="info"
            icon={Flame}
          />
        </section>
      )}

      {geoError && !geoLoading && (
        <section>
          <PageErrorState
            message="Gagal memuat data permintaan regional"
            onRetry={() => refetch()}
          />
        </section>
      )}

      {!geoError && (
        <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-[#0F172A]">
              Heatmap Permintaan
            </h2>

            {geoLoading ? (
              <Card className="rounded-2xl">
                <CardContent className="flex h-[400px] items-center justify-center pt-6">
                  <Loader2 className="h-5 w-5 animate-spin text-[#94A3B8]" />
                </CardContent>
              </Card>
            ) : regions.length === 0 ? (
              <Card className="rounded-2xl">
                <CardContent className="flex h-[400px] flex-col items-center justify-center pt-6">
                  <MapPin className="mb-3 h-10 w-10 text-[#CBD5E1]" />
                  <p className="text-sm text-[#64748B]">
                    Belum ada data permintaan regional.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {sortedRegions.map((r) => (
                  <button
                    key={r.region}
                    type="button"
                    onClick={() =>
                      setSelectedRegion((prev) =>
                        prev === r.region ? undefined : r.region,
                      )
                    }
                    className={`group relative flex flex-col gap-2 rounded-2xl border-2 p-4 text-left transition-all hover:shadow-md ${getHeatBorder(r.demand_score, minScore, maxScore)} ${
                      selectedRegion === r.region
                        ? "ring-2 ring-[#3B82F6] ring-offset-2"
                        : ""
                    }`}
                  >
                    <div
                      className={`absolute inset-0 rounded-2xl ${getHeatColor(r.demand_score, minScore, maxScore)} opacity-15 transition-opacity group-hover:opacity-25`}
                    />
                    <div className="relative space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-[#0F172A]">
                          {r.region}
                        </p>
                        <Badge
                          tone={r.growth_pct >= 0 ? "success" : "danger"}
                          className="gap-0.5"
                        >
                          {r.growth_pct >= 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {r.growth_pct >= 0 ? "+" : ""}
                          {r.growth_pct}%
                        </Badge>
                      </div>
                      <div className="flex items-end gap-1.5">
                        <span className="text-2xl font-bold tracking-tight text-[#0F172A]">
                          {r.demand_score}
                        </span>
                        <span className="mb-0.5 text-xs text-[#64748B]">
                          demand score
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all"
                          style={{
                            width: `${maxScore === minScore ? 100 : ((r.demand_score - minScore) / (maxScore - minScore)) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {sortedRegions.length > 0 && (
              <div className="flex items-center gap-2 px-1">
                <span className="text-[10px] text-[#64748B]">Rendah</span>
                <div className="flex flex-1 gap-0.5">
                  <div className="h-2 flex-1 rounded-l-full bg-blue-100" />
                  <div className="h-2 flex-1 bg-blue-300" />
                  <div className="h-2 flex-1 bg-blue-400" />
                  <div className="h-2 flex-1 bg-blue-500" />
                  <div className="h-2 flex-1 rounded-r-full bg-blue-600" />
                </div>
                <span className="text-[10px] text-[#64748B]">Tinggi</span>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-[#0F172A]">
              Detail Wilayah
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
                      Data berdasarkan pesanan dari distributor partner.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="rounded-2xl">
                <CardContent className="flex h-[200px] flex-col items-center justify-center pt-6">
                  <MapPin className="mb-3 h-8 w-8 text-[#CBD5E1]" />
                  <p className="text-sm text-[#64748B]">
                    Pilih wilayah pada heatmap untuk melihat detail.
                  </p>
                </CardContent>
              </Card>
            )}

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-[#0F172A]">
                Peringkat Permintaan
              </h3>
              {geoLoading ? (
                <div className="flex h-[200px] items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-[#94A3B8]" />
                </div>
              ) : sortedRegions.length === 0 ? (
                <p className="py-4 text-center text-sm text-[#64748B]">
                  Belum ada data.
                </p>
              ) : (
                <Card className="rounded-2xl">
                  <CardContent className="pt-4">
                    <div className="space-y-0">
                      <div className="grid grid-cols-12 gap-4 border-b border-[#E2E8F0] pb-3 text-xs uppercase tracking-wider text-[#64748B]">
                        <div className="col-span-1">#</div>
                        <div className="col-span-5">Wilayah</div>
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