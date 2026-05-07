"use client";

import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { LegacyDialog as Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAddInventoryItem, useUpdateInventoryItem } from "@/hooks/useInventory";
import type { InventoryItem, AddItemPayload } from "@/hooks/useInventory";

type Props = {
  open: boolean;
  onClose: () => void;
  editItem?: InventoryItem | null;
  showPrice?: boolean;
  priceLabel?: string;
};

const UNITS = ["kg", "liter", "pcs", "bottle", "box", "karung", "dus"];
const CATEGORIES = ["bahan_baku", "packaging", "produk_jadi", "peralatan", "lainnya"];

function parseNum(s: string): number {
  const n = parseFloat(s.replace(/,/g, ""));
  return isNaN(n) || n < 0 ? 0 : n;
}

function normalizeNumStr(s: string): string {
  const n = parseNum(s);
  return String(n);
}

export function ItemFormDialog({ open, onClose, editItem, showPrice = false, priceLabel = "Harga jual (IDR)" }: Props) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("bahan_baku");
  const [unit, setUnit] = useState("kg");
  const [stockStr, setStockStr] = useState("0");
  const [minStockStr, setMinStockStr] = useState("0");
  const [priceStr, setPriceStr] = useState("0");
  const [error, setError] = useState<string | null>(null);

  const add = useAddInventoryItem();
  const update = useUpdateInventoryItem();
  const isLoading = add.isPending || update.isPending;

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      if (editItem) {
        setName(editItem.name);
        setCategory(editItem.category);
        setUnit(editItem.unit);
        setStockStr(String(editItem.stock));
        setMinStockStr(String(editItem.min_stock));
        setPriceStr(String(editItem.price ?? 0));
      } else {
        setName("");
        setCategory("bahan_baku");
        setUnit("kg");
        setStockStr("0");
        setMinStockStr("0");
        setPriceStr("0");
      }
      setError(null);
    }, 0);
    return () => clearTimeout(t);
  }, [open, editItem]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload: AddItemPayload = {
      name,
      category,
      unit,
      stock: parseNum(stockStr),
      min_stock: parseNum(minStockStr),
      price: showPrice ? parseNum(priceStr) : 0,
    };
    try {
      if (editItem) {
        await update.mutateAsync({ id: editItem.id, payload });
      } else {
        await add.mutateAsync(payload);
      }
      onClose();
    } catch {
      setError("Gagal menyimpan item. Coba lagi.");
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editItem ? "Edit Item" : "Tambah Item Baru"}
      description={editItem ? "Ubah detail stok atau info item." : "Isi detail item yang ingin ditambahkan ke inventory."}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[#0F172A]">Nama item</label>
          <Input
            placeholder="Tepung Terigu"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#0F172A]">Kategori</label>
            <select
              className="h-11 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm text-[#0F172A] outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#BFDBFE]"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={isLoading}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.replace("_", " ")}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#0F172A]">Unit</label>
            <select
              className="h-11 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm text-[#0F172A] outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#BFDBFE]"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              disabled={isLoading}
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#0F172A]">Stok saat ini</label>
            <Input
              inputMode="numeric"
              value={stockStr}
              onChange={(e) => setStockStr(e.target.value.replace(/[^0-9]/g, ""))}
              onBlur={() => setStockStr(normalizeNumStr(stockStr))}
              onFocus={(e) => { if (e.target.value === "0") e.target.select(); }}
              required
              disabled={isLoading}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#0F172A]">Minimum stok</label>
            <Input
              inputMode="numeric"
              value={minStockStr}
              onChange={(e) => setMinStockStr(e.target.value.replace(/[^0-9]/g, ""))}
              onBlur={() => setMinStockStr(normalizeNumStr(minStockStr))}
              onFocus={(e) => { if (e.target.value === "0") e.target.select(); }}
              required
              disabled={isLoading}
            />
          </div>
        </div>

        {showPrice && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#0F172A]">{priceLabel}</label>
            <Input
              inputMode="numeric"
              placeholder="Contoh: 15000"
              value={priceStr}
              onChange={(e) => setPriceStr(e.target.value.replace(/[^0-9]/g, ""))}
              onBlur={() => setPriceStr(normalizeNumStr(priceStr))}
              onFocus={(e) => { if (e.target.value === "0") e.target.select(); }}
              required
              disabled={isLoading}
            />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2.5 text-sm text-[#DC2626]">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
            Batal
          </Button>
          <Button type="submit" disabled={isLoading || !name}>
            {isLoading ? "Menyimpan..." : editItem ? "Simpan Perubahan" : "Tambah Item"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
