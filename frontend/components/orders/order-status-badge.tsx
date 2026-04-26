import { Badge } from "@/components/ui/badge";

export type OrderStatus =
  | "pending"
  | "processing"
  | "shipping"
  | "delivered"
  | "cancelled";

const statusConfig: Record<
  OrderStatus,
  { label: string; tone: "warning" | "info" | "success" | "danger" | "neutral" }
> = {
  pending: {
    label: "Pending",
    tone: "warning",
  },
  processing: {
    label: "Processing",
    tone: "info",
  },
  shipping: {
    label: "Shipping",
    tone: "info",
  },
  delivered: {
    label: "Delivered",
    tone: "success",
  },
  cancelled: {
    label: "Cancelled",
    tone: "danger",
  },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const config = statusConfig[status];

  return <Badge tone={config.tone}>{config.label}</Badge>;
}
