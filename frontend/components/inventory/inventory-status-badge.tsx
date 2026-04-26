import { Badge } from "@/components/ui/badge";

export type InventoryStatus = "in_stock" | "low_stock" | "out_of_stock";

const statusConfig: Record<
  InventoryStatus,
  { label: string; tone: "success" | "warning" | "danger" }
> = {
  in_stock: {
    label: "In Stock",
    tone: "success",
  },
  low_stock: {
    label: "Low Stock",
    tone: "warning",
  },
  out_of_stock: {
    label: "Out of Stock",
    tone: "danger",
  },
};

export function InventoryStatusBadge({ status }: { status: InventoryStatus }) {
  const config = statusConfig[status];

  return <Badge tone={config.tone}>{config.label}</Badge>;
}
