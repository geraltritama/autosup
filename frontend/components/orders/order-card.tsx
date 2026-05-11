import { CheckCircle, Eye, MapPin, Truck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { OrderProgress } from "@/components/orders/order-progress";
import { OrderStatusBadge, type OrderStatus } from "@/components/orders/order-status-badge";

export interface OrderCardData {
  order_id: string;
  order_number: string;
  buyer: { id: string; name: string; role: string };
  seller: { id: string; name: string; role: string };
  items: Array<{
    item_name?: string;
    product_name?: string;
    name?: string;
    qty?: number;
    quantity?: number;
    unit?: string;
    price_per_unit?: number;
    subtotal?: number;
  }>;
  total_amount: number;
  status: OrderStatus;
  escrow_status: "held" | "released" | "refunded";
  delivery_address: string;
  estimated_delivery: string;
  shipping_info?: {
    courier: string;
    tracking_number: string;
    shipped_at: string;
    tracking_url?: string;
  };
  created_at: string;
  updated_at: string;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

interface OrderCardProps {
  order: OrderCardData;
  userRole?: "distributor" | "supplier" | "retailer";
  onViewDetail?: (orderId: string) => void;
  onShip?: (orderId: string) => void;
  onApprove?: (orderId: string) => void;
  onReject?: (orderId: string) => void;
}

export function OrderCard({ order, userRole, onViewDetail, onShip, onApprove, onReject }: OrderCardProps) {
  const previewItems = order.items
    .slice(0, 2)
    .map((item) => `${item.item_name || item.product_name || item.name || "Item"} (${item.qty || item.quantity || 0} ${item.unit || "pcs"})`)
    .join(", ");

  const isTerminal = order.status === "delivered" || order.status === "cancelled";
  const isSeller = order.seller.role === userRole;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="space-y-4 border-b border-[#E2E8F0] pb-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-semibold text-[#0F172A]">{order.order_number}</p>
              <OrderStatusBadge status={order.status} />
              {order.shipping_info && (
                <div className="flex items-center gap-1.5 rounded-lg bg-[#F0F9FF] px-2.5 py-1.5 text-xs font-medium text-[#0284C7]">
                  <Truck className="h-3.5 w-3.5" />
                  <span>{order.shipping_info.courier}</span>
                  <span className="text-[#94A3B8]">·</span>
                  <span className="font-mono">{order.shipping_info.tracking_number}</span>
                </div>
              )}
            </div>
            <div className="grid gap-1 text-sm text-[#64748B]">
              <p>
                Buyer: <span className="font-medium text-[#0F172A]">{order.buyer.name}</span>
              </p>
              <p>
                Seller: <span className="font-medium text-[#0F172A]">{order.seller.name}</span>
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 px-4 py-3 text-right">
            <p className="text-xs uppercase tracking-[0.18em] text-[#64748B]">Total Amount</p>
            <p className="mt-1 text-xl font-semibold text-[#0F172A]">
              {formatCurrency(order.total_amount)}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 p-5">
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4 rounded-xl bg-slate-50 p-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[#64748B]">Items Preview</p>
              <p className="mt-2 text-sm font-medium leading-6 text-[#0F172A]">{previewItems}</p>
            </div>
            <div className="flex items-start gap-2 text-sm text-[#64748B]">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{order.delivery_address}</span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[#E2E8F0] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[#64748B]">
                Estimated delivery
              </p>
              <p className="mt-2 text-sm font-semibold text-[#0F172A]">
                {order.estimated_delivery}
              </p>
            </div>
            <div className="rounded-xl border border-[#E2E8F0] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[#64748B]">
                Updated at
              </p>
              <p className="mt-2 text-sm font-semibold text-[#0F172A]">
                {order.updated_at}
              </p>
            </div>
          </div>
        </div>

        <OrderProgress status={order.status} />

        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" className="gap-2" onClick={() => onViewDetail?.(order.order_id)}>
            <Eye className="h-4 w-4" />
            View Details
          </Button>

          {/* Seller: Approve / Reject for pending orders */}
          {isSeller && order.status === "pending" && (
            <>
              <Button
                variant="secondary"
                className="gap-2 border-red-200 text-red-600 hover:bg-red-50"
                onClick={() => onReject?.(order.order_id)}
              >
                <XCircle className="h-4 w-4" />
                Reject
              </Button>
              <Button
                className="gap-2"
                onClick={() => onApprove?.(order.order_id)}
              >
                <CheckCircle className="h-4 w-4" />
                Approve
              </Button>
            </>
          )}

          {/* Seller: Ship (input tracking info) */}
          {isSeller && order.status === "processing" && (
            <Button
              className="gap-2"
              onClick={() => onShip?.(order.order_id)}
            >
              <Truck className="h-4 w-4" />
              Ship
            </Button>
          )}

          {/* Delivered: show escrow info */}
          {order.status === "delivered" && (
            <Button variant="secondary" className="gap-2 text-[#22C55E]" disabled>
              <Truck className="h-4 w-4" />
              Payment Complete
            </Button>
          )}

          {/* Buyer: track delivery */}
          {(userRole === "distributor" || userRole === "retailer") && !isTerminal && (
            <Button className="gap-2" onClick={() => onViewDetail?.(order.order_id)}>
              <Truck className="h-4 w-4" />
              Track Delivery
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
