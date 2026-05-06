"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";

export type InventoryStatus = "in_stock" | "low_stock" | "out_of_stock";

export type InventoryItem = {
  id: string;
  name: string;
  category: string;
  stock: number;
  min_stock: number;
  unit: string;
  status: InventoryStatus;
  last_updated: string;
};

export type InventoryResponse = {
  items: InventoryItem[];
  summary: {
    total_items: number;
    low_stock_count: number;
    out_of_stock_count: number;
  };
  pagination: { page: number; limit: number; total: number };
};

export type AddItemPayload = {
  name: string;
  category: string;
  stock: number;
  min_stock: number;
  unit: string;
};

export type UpdateItemPayload = Partial<AddItemPayload>;

export type RestockRecommendation = {
  item_id: string;
  item_name: string;
  current_stock: number;
  min_stock: number;
  recommendation: string;
  suggested_qty: number;
  suggested_unit: string;
  suggested_seller: {
    seller_id: string;
    name: string;
    seller_type: "supplier" | "distributor";
    reputation_score: number;
    estimated_delivery_days: number;
  } | null;
  urgency: "high" | "medium" | "low";
  generated_at: string;
};

type InventoryFilters = {
  search?: string;
  status?: string;
  category?: string;
  page?: number;
  limit?: number;
};

export function useInventory(filters: InventoryFilters = {}) {
  return useQuery({
    queryKey: ["inventory", filters],
    queryFn: async (): Promise<InventoryResponse> => {
      // Backend returns flat array: [{id, name, stock, min_stock, category, unit}]
      // Filter/pagination done client-side since backend doesn't support query params
      type BackendItem = { id: string; name: string; stock: number; min_stock: number; category: string; unit: string };
      const { data } = await api.get<ApiResponse<BackendItem[]>>("/inventory");
      const allItems: InventoryItem[] = data.data.map((item) => ({
        ...item,
        status: item.stock === 0 ? "out_of_stock" : item.stock < item.min_stock ? "low_stock" : "in_stock",
        last_updated: new Date().toISOString(),
      }));
      const filtered = allItems.filter((item) => {
        if (filters.search && !item.name.toLowerCase().includes(filters.search.toLowerCase())) return false;
        if (filters.status && item.status !== filters.status) return false;
        if (filters.category && !item.category.toLowerCase().includes(filters.category.toLowerCase())) return false;
        return true;
      });
      return {
        items: filtered,
        summary: {
          total_items: allItems.length,
          low_stock_count: allItems.filter((i) => i.status === "low_stock").length,
          out_of_stock_count: allItems.filter((i) => i.status === "out_of_stock").length,
        },
        pagination: { page: 1, limit: filtered.length, total: filtered.length },
      };
    },
    staleTime: 30 * 1000,
  });
}

export function useAddInventoryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: AddItemPayload): Promise<InventoryItem> => {
      // Backend expects {product_name, current_stock}; map from frontend payload
      const { data } = await api.post<ApiResponse<InventoryItem>>("/inventory", {
        product_name: payload.name,
        current_stock: payload.stock,
      });
      const item = data.data as unknown as { id: string; name: string; stock: number; min_stock: number; category: string; unit: string };
      return {
        id: item.id,
        name: item.name,
        stock: item.stock,
        min_stock: item.min_stock ?? payload.min_stock,
        category: item.category ?? payload.category,
        unit: item.unit ?? payload.unit,
        status: item.stock === 0 ? "out_of_stock" : item.stock < (item.min_stock ?? payload.min_stock) ? "low_stock" : "in_stock",
        last_updated: new Date().toISOString(),
      };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory"] }),
  });
}

export function useUpdateInventoryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateItemPayload;
    }): Promise<InventoryItem> => {
      // Backend only accepts {current_stock} via PATCH
      const { data } = await api.patch<ApiResponse<InventoryItem>>(
        `/inventory/${id}`,
        { current_stock: payload.stock ?? 0 },
      );
      const item = data.data as unknown as { id: string; name: string; stock: number; min_stock: number; category: string; unit: string };
      return {
        id: item.id,
        name: item.name,
        stock: item.stock,
        min_stock: item.min_stock,
        category: item.category,
        unit: item.unit,
        status: item.stock === 0 ? "out_of_stock" : item.stock < item.min_stock ? "low_stock" : "in_stock",
        last_updated: new Date().toISOString(),
      };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory"] }),
  });
}

export function useDeleteInventoryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.delete(`/inventory/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory"] }),
  });
}

export function useRestockRecommendation() {
  return useMutation({
    mutationFn: async (item_id: string): Promise<RestockRecommendation> => {
      const { data } = await api.post<ApiResponse<RestockRecommendation>>(
        "/ai/restock-recommendation",
        { item_id },
      );
      return data.data;
    },
  });
}
