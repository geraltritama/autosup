import { Badge } from "@/components/ui/badge";

export type SupplierType = "partner" | "pending" | "discover";

export function SupplierTypeBadge({ type }: { type: SupplierType }) {
  if (type === "partner") {
    return <Badge tone="success">Partner</Badge>;
  }
  if (type === "pending") {
    return <Badge tone="warning">Pending</Badge>;
  }
  return <Badge tone="info">Discover</Badge>;
}
