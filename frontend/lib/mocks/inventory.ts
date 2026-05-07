import type { InventoryResponse, InventoryItem } from "@/hooks/useInventory";

export const mockInventoryItems: InventoryItem[] = [
  {
    id: "item-uuid-001",
    name: "Tepung Terigu",
    category: "bahan_baku",
    stock: 15,
    min_stock: 50,
    unit: "kg",
    price: 0,
    status: "low_stock",
    last_updated: "2025-07-10T08:30:00Z",
  },
  {
    id: "item-uuid-002",
    name: "Gula Pasir",
    category: "bahan_baku",
    stock: 200,
    min_stock: 100,
    unit: "kg",
    price: 0,
    status: "in_stock",
    last_updated: "2025-07-09T14:00:00Z",
  },
  {
    id: "item-uuid-003",
    name: "Minyak Goreng",
    category: "bahan_baku",
    stock: 0,
    min_stock: 30,
    unit: "liter",
    price: 0,
    status: "out_of_stock",
    last_updated: "2025-07-10T09:10:00Z",
  },
  {
    id: "item-uuid-004",
    name: "Cup Packaging 16oz",
    category: "packaging",
    stock: 560,
    min_stock: 200,
    unit: "pcs",
    price: 0,
    status: "in_stock",
    last_updated: "2025-07-10T07:45:00Z",
  },
  {
    id: "item-uuid-005",
    name: "Brown Sugar Syrup",
    category: "produk_jadi",
    stock: 22,
    min_stock: 40,
    unit: "bottle",
    price: 0,
    status: "low_stock",
    last_updated: "2025-07-10T06:55:00Z",
  },
];

export function getMockInventory(params: {
  search?: string;
  status?: string;
  category?: string;
  page?: number;
  limit?: number;
}): InventoryResponse {
  let items = [...mockInventoryItems];

  if (params.search) {
    items = items.filter((i) =>
      i.name.toLowerCase().includes(params.search!.toLowerCase()),
    );
  }
  if (params.status) {
    items = items.filter((i) => i.status === params.status);
  }
  if (params.category) {
    items = items.filter((i) => i.category === params.category);
  }

  const total = items.length;
  const limit = params.limit ?? 20;
  const page = params.page ?? 1;
  const start = (page - 1) * limit;
  items = items.slice(start, start + limit);

  return {
    items,
    summary: {
      total_items: mockInventoryItems.length,
      low_stock_count: mockInventoryItems.filter((i) => i.status === "low_stock").length,
      out_of_stock_count: mockInventoryItems.filter((i) => i.status === "out_of_stock").length,
    },
    pagination: { page, limit, total },
  };
}
