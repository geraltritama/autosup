"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { LegacyDialog as Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useDeleteInventoryItem } from "@/hooks/useInventory";
import type { InventoryItem } from "@/hooks/useInventory";
import { CATEGORY_LABELS } from "@/components/inventory/category-labels";

type Props = {
  open: boolean;
  onClose: () => void;
  item: InventoryItem | null;
};

export function DeleteConfirmDialog({ open, onClose, item }: Props) {
  const [error, setError] = useState<string | null>(null);
  const del = useDeleteInventoryItem();

  async function handleDelete() {
    if (!item) return;
    setError(null);
    try {
      await del.mutateAsync(item.id);
      onClose();
    } catch {
      setError("Failed to delete item. Please try again.");
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Delete Item" description={`Are you sure you want to delete "${item?.name}"? This action cannot be undone.`}>
      <div className="space-y-4">
        {item && (
          <div className="rounded-xl border border-[#E2E8F0] bg-slate-50 p-4">
            <p className="text-sm font-semibold text-[#0F172A]">{item.name}</p>
            <p className="mt-1 text-xs text-[#64748B]">
              Stock: {item.stock} {item.unit} · Category: {CATEGORY_LABELS[item.category] || item.category}
            </p>
          </div>
        )}

        {error && (
          <p className="text-sm text-[#DC2626]">{error}</p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={del.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            disabled={del.isPending}
            className="gap-2 bg-[#EF4444] hover:bg-red-600"
          >
            <Trash2 className="h-4 w-4" />
            {del.isPending ? "Deleting..." : "Delete Item"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
