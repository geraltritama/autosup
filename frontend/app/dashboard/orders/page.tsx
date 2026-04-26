import { CheckCheck, Clock3, PackageOpen, Plus, Truck } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { OrderCard, type OrderCardData } from "@/components/orders/order-card";
import { OrdersEmptyState } from "@/components/orders/orders-empty-state";
import { OrdersErrorState } from "@/components/orders/orders-error-state";
import { OrdersFilterBar } from "@/components/orders/orders-filter-bar";
import { OrdersLoadingState } from "@/components/orders/orders-loading-state";
import { OrdersTrustPanel } from "@/components/orders/orders-trust-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const orders: OrderCardData[] = [
  {
    order_id: "order-uuid-001",
    order_number: "ORD-2025-001",
    buyer: {
      id: "user-uuid-001",
      name: "Toko Budi Jaya",
      role: "distributor",
    },
    seller: {
      id: "supplier-uuid-001",
      name: "CV Maju Bersama",
      role: "supplier",
    },
    items: [
      {
        item_name: "Tepung Terigu",
        qty: 100,
        unit: "kg",
        price_per_unit: 12000,
        subtotal: 1200000,
      },
      {
        item_name: "Gula Pasir",
        qty: 50,
        unit: "kg",
        price_per_unit: 14500,
        subtotal: 725000,
      },
    ],
    total_amount: 1925000,
    status: "processing",
    delivery_address: "Jl. Merdeka No.10, Jakarta",
    estimated_delivery: "12 Jul 2025",
    created_at: "10 Jul 2025, 09:00",
    updated_at: "10 Jul 2025, 10:00",
  },
  {
    order_id: "order-uuid-002",
    order_number: "ORD-2025-002",
    buyer: {
      id: "user-uuid-001",
      name: "Toko Budi Jaya",
      role: "distributor",
    },
    seller: {
      id: "supplier-uuid-003",
      name: "Nusantara Supply Co.",
      role: "supplier",
    },
    items: [
      {
        item_name: "Cup Packaging 16oz",
        qty: 300,
        unit: "pcs",
        price_per_unit: 900,
        subtotal: 270000,
      },
    ],
    total_amount: 270000,
    status: "shipping",
    delivery_address: "Jl. Pahlawan No.22, Bandung",
    estimated_delivery: "11 Jul 2025",
    created_at: "09 Jul 2025, 15:20",
    updated_at: "10 Jul 2025, 07:10",
  },
  {
    order_id: "order-uuid-003",
    order_number: "ORD-2025-003",
    buyer: {
      id: "user-uuid-002",
      name: "Kopi Urban Station",
      role: "distributor",
    },
    seller: {
      id: "supplier-uuid-002",
      name: "PT Sejahtera Abadi",
      role: "supplier",
    },
    items: [
      {
        item_name: "Minyak Goreng",
        qty: 40,
        unit: "liter",
        price_per_unit: 17000,
        subtotal: 680000,
      },
    ],
    total_amount: 680000,
    status: "delivered",
    delivery_address: "Jl. Cempaka Baru No.8, Surabaya",
    estimated_delivery: "09 Jul 2025",
    created_at: "07 Jul 2025, 11:40",
    updated_at: "09 Jul 2025, 16:10",
  },
  {
    order_id: "order-uuid-004",
    order_number: "ORD-2025-004",
    buyer: {
      id: "user-uuid-003",
      name: "Dapur Sentosa",
      role: "distributor",
    },
    seller: {
      id: "supplier-uuid-004",
      name: "Prima Kitchen Goods",
      role: "supplier",
    },
    items: [
      {
        item_name: "Brown Sugar Syrup",
        qty: 24,
        unit: "bottle",
        price_per_unit: 48000,
        subtotal: 1152000,
      },
    ],
    total_amount: 1152000,
    status: "pending",
    delivery_address: "Jl. Melati Indah No.4, Yogyakarta",
    estimated_delivery: "13 Jul 2025",
    created_at: "10 Jul 2025, 11:05",
    updated_at: "10 Jul 2025, 11:05",
  },
];

const summary = {
  activeOrders: 5,
  pendingOrders: 2,
  shippingOrders: 1,
  deliveredThisMonth: 18,
};

export default function OrdersPage() {
  return (
    <main className="space-y-6 px-6 py-6 lg:px-8 lg:py-8">
      <section className="flex flex-col gap-4 rounded-3xl border border-[#E2E8F0] bg-white px-6 py-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <Badge tone="info">Order operations</Badge>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-[#0F172A]">
              Orders
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-[#64748B]">
              Pantau alur order dari pending sampai delivered dengan tampilan operasional yang ringkas, jelas, dan siap disambungkan ke workflow nyata.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary">View Tracking</Button>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Create Order
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Active Orders"
          value={String(summary.activeOrders)}
          meta="Currently in motion"
          tone="info"
          icon={PackageOpen}
        />
        <KpiCard
          label="Pending Orders"
          value={String(summary.pendingOrders)}
          meta="Need supplier response"
          tone="warning"
          icon={Clock3}
        />
        <KpiCard
          label="Shipping Orders"
          value={String(summary.shippingOrders)}
          meta="In transit now"
          tone="info"
          icon={Truck}
        />
        <KpiCard
          label="Delivered This Month"
          value={String(summary.deliveredThisMonth)}
          meta="Completed successfully"
          tone="success"
          icon={CheckCheck}
        />
      </section>

      <OrdersFilterBar />

      <section className="grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
        <div className="grid gap-4">
          {orders.map((order) => (
            <OrderCard key={order.order_id} order={order} />
          ))}
        </div>

        <div className="space-y-6">
          <OrdersTrustPanel />
          <OrdersErrorState />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <OrdersEmptyState />
        <OrdersLoadingState />
      </section>
    </main>
  );
}
