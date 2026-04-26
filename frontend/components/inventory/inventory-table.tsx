import { Eye, MoreHorizontal, PencilLine, RefreshCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InventoryStatusBadge, type InventoryStatus } from "@/components/inventory/inventory-status-badge";

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  stock: number;
  min_stock: number;
  unit: string;
  status: InventoryStatus;
  last_updated: string;
}

export function InventoryTable({ items }: { items: InventoryItem[] }) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="border-b border-[#E2E8F0] pb-4">
        <CardTitle>Inventory Overview</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-slate-50/70 text-left">
                {[
                  "Item Name",
                  "Category",
                  "Stock",
                  "Minimum Stock",
                  "Unit",
                  "Status",
                  "Last Updated",
                  "Actions",
                ].map((column) => (
                  <th
                    key={column}
                    className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B]"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-[#E2E8F0] last:border-b-0">
                  <td className="px-5 py-4">
                    <div>
                      <p className="text-sm font-semibold text-[#0F172A]">{item.name}</p>
                      <p className="mt-1 text-xs text-[#94A3B8]">{item.id}</p>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-[#475569]">{item.category}</td>
                  <td className="px-5 py-4 text-sm font-medium text-[#0F172A]">{item.stock}</td>
                  <td className="px-5 py-4 text-sm text-[#475569]">{item.min_stock}</td>
                  <td className="px-5 py-4 text-sm text-[#475569]">{item.unit}</td>
                  <td className="px-5 py-4">
                    <InventoryStatusBadge status={item.status} />
                  </td>
                  <td className="px-5 py-4 text-sm text-[#475569]">{item.last_updated}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <button className="rounded-lg border border-[#E2E8F0] p-2 text-[#64748B] transition hover:bg-slate-50 hover:text-[#0F172A]">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button className="rounded-lg border border-[#E2E8F0] p-2 text-[#64748B] transition hover:bg-slate-50 hover:text-[#0F172A]">
                        <PencilLine className="h-4 w-4" />
                      </button>
                      <button className="rounded-lg border border-[#E2E8F0] p-2 text-[#64748B] transition hover:bg-slate-50 hover:text-[#0F172A]">
                        <RefreshCcw className="h-4 w-4" />
                      </button>
                      <button className="rounded-lg border border-[#E2E8F0] p-2 text-[#64748B] transition hover:bg-slate-50 hover:text-[#0F172A]">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
