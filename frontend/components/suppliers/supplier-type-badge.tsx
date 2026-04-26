import { Badge } from "@/components/ui/badge";

export type SupplierType = "partner" | "discover";

export function SupplierTypeBadge({ type }: { type: SupplierType }) {
  if (type === "partner") {
    return <Badge tone="success">Partner</Badge>;
  }

  return <Badge tone="info">Discover</Badge>;
}
