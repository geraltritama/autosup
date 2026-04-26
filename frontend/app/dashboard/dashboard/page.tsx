import {
  BarChart3,
  Boxes,
  Building2,
  Clock3,
  PackageCheck,
} from "lucide-react";
import { ActivityList } from "@/components/dashboard/activity-list";
import { InsightCard } from "@/components/dashboard/insight-card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { MockBarChart } from "@/components/dashboard/mock-bar-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";

const kpis = [
  {
    label: "Total produk aktif",
    value: "124",
    meta: "+8 minggu ini",
    tone: "info" as const,
    icon: Boxes,
  },
  {
    label: "Distributor partner",
    value: "18",
    meta: "4 request pending",
    tone: "success" as const,
    icon: Building2,
  },
  {
    label: "Incoming orders",
    value: "32",
    meta: "9 perlu diproses hari ini",
    tone: "warning" as const,
    icon: PackageCheck,
  },
  {
    label: "Avg. processing time",
    value: "2.4h",
    meta: "lebih cepat 12%",
    tone: "success" as const,
    icon: Clock3,
  },
];

const activityItems = [
  {
    id: "1",
    type: "order" as const,
    title: "Jakarta Wholesale placed a new order",
    description: "Premium Flour 120 kg dan Sugar 90 kg masuk ke antrian pemrosesan.",
    time: "2h ago",
  },
  {
    id: "2",
    type: "demand" as const,
    title: "Demand increased for cooking oil",
    description: "AI mendeteksi tren naik 18% dari distributor aktif di wilayah barat.",
    time: "4h ago",
  },
  {
    id: "3",
    type: "shipment" as const,
    title: "Shipment ORD-203 ready for dispatch",
    description: "Tim fulfillment sudah menyelesaikan packing dan menunggu pickup logistics partner.",
    time: "5h ago",
  },
];

const chartData = [
  { label: "Mon", value: 46 },
  { label: "Tue", value: 58 },
  { label: "Wed", value: 62, active: true },
  { label: "Thu", value: 74 },
  { label: "Fri", value: 69 },
  { label: "Sat", value: 88 },
];

const topProducts = [
  { name: "Premium Flour", volume: "1.24T", growth: "+25%", progress: 82 },
  { name: "Sugar", volume: "980kg", growth: "+17%", progress: 66 },
  { name: "Cooking Oil", volume: "710L", growth: "-4%", progress: 48 },
];

export default function SupplierDashboardPage() {
  return (
    <main className="space-y-8 px-6 py-6 lg:px-8 lg:py-8">
      <section className="flex flex-col gap-4 rounded-3xl border border-[#E2E8F0] bg-white px-6 py-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <Badge tone="info">Supplier dashboard</Badge>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-[#0F172A]">
              Monitor demand, orders, and distributor activity
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-[#64748B]">
              Fondasi dashboard supplier AUTOSUP untuk memantau permintaan, readiness stok, order masuk, dan insight operasional dari AI.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary">Review pending orders</Button>
          <Button>Open operations queue</Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </section>

      <section>
        <InsightCard />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <Card className="rounded-2xl">
          <CardHeader className="space-y-4">
            <SectionHeading
              title="Demand performance"
              description="Mock demand trend mingguan untuk membantu supplier melihat momentum order."
              action={<Badge tone="success">+14% week over week</Badge>}
            />
          </CardHeader>
          <CardContent className="space-y-6">
            <MockBarChart data={chartData} />
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[#64748B]">Peak demand</p>
                <p className="mt-2 text-lg font-semibold text-[#0F172A]">Saturday</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[#64748B]">Primary area</p>
                <p className="mt-2 text-lg font-semibold text-[#0F172A]">Jakarta</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[#64748B]">Forecast confidence</p>
                <p className="mt-2 text-lg font-semibold text-[#0F172A]">Medium</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Top products</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {topProducts.map((item) => (
              <div key={item.name} className="space-y-2 rounded-xl border border-[#E2E8F0] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#0F172A]">{item.name}</p>
                    <p className="text-xs text-[#64748B]">{item.volume} demand volume</p>
                  </div>
                  <Badge tone={item.growth.startsWith("-") ? "danger" : "success"}>
                    {item.growth}
                  </Badge>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-[#3B82F6]"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <ActivityList items={activityItems} />

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Operational queue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              {
                title: "Pending approvals",
                value: "04",
                description: "Partnership request dan order yang perlu tindakan cepat.",
              },
              {
                title: "Shipping readiness",
                value: "87%",
                description: "Sebagian besar antrian fulfillment sudah siap dispatch.",
              },
              {
                title: "Stock threshold alerts",
                value: "06",
                description: "Enam SKU butuh perhatian sebelum lonjakan order berikutnya.",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border border-[#E2E8F0] p-4">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-sm text-[#64748B]">{item.title}</p>
                    <p className="mt-2 text-2xl font-semibold text-[#0F172A]">{item.value}</p>
                  </div>
                  <BarChart3 className="h-5 w-5 text-[#94A3B8]" />
                </div>
                <p className="mt-3 text-sm leading-6 text-[#64748B]">{item.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
