"use client";

import { Loader2, Package } from "lucide-react";
import { LegacyDialog as Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useSupplierStock } from "@/hooks/useSuppliers";

const stockStatusTone = { in_stock: "success", low_stock: "warning", out_of_stock: "danger" } as const;
const stockStatusLabel = { in_stock: "In Stock", low_stock: "Low Stock", out_of_stock: "Out of Stock" } as const;

type Props = {
  supplierId: string | null;
  supplierName: string;
  open: boolean;
  onClose: () => void;
};

export function SupplierStockDialog({ supplierId, supplierName, open, onClose }: Props) {
  const { data, isLoading } = useSupplierStock(open ? supplierId : null);

  return (
    <Dialog open={open} onClose={onClose} title={`Supplier Stock: ${supplierName}`} description="Real-time inventory from your partner supplier.">
      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-[#94A3B8]" />
        </div>
      ) : !data || data.products.length === 0 ? (
        <p className="text-center text-sm text-[#64748B] py-8">No stock data available yet.</p>
      ) : (
        <div className="space-y-3">
          {data.products.map((product) => (
            <div key={product.item_id} className="flex items-center justify-between rounded-xl border border-[#E2E8F0] p-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-[#64748B]" />
                  <p className="text-sm font-semibold text-[#0F172A]">{product.name}</p>
                  <Badge tone={stockStatusTone[product.status]}>{stockStatusLabel[product.status]}</Badge>
                </div>
                <p className="text-xs text-[#64748B]">
                  Stock: <span className="font-medium text-[#0F172A]">{product.stock} {product.unit}</span>
                  {" · "}Min: {product.min_stock} {product.unit}
                  {product.estimated_restock_days !== null && (
                    <span className="text-[#F59E0B]"> · Restock ~{product.estimated_restock_days} days</span>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Dialog>
  );
}