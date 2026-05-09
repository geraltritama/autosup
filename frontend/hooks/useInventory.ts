"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";

export type InventoryStatus = "in_stock" | "low_stock" | "out_of_stock";

export type InventoryItem = {
  id: string;
  name: string;
  category: string;
  stock: number;
  min_stock: number;
  unit: string;
  price: number;
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
  price: number;
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
  const userId = useAuthStore((s) => s.user?.user_id);
  return useQuery({
    queryKey: ["inventory", filters, userId],
    queryFn: async (): Promise<InventoryResponse> => {
      type BackendItem = { id: string; name: string; stock: number; min_stock: number; category: string; unit: string; price?: number };
      const params = userId ? `?user_id=${userId}` : "";
      const { data } = await api.get<ApiResponse<BackendItem[]>>(`/inventory${params}`);
      const allItems: InventoryItem[] = (data.data ?? []).map((item) => ({
        ...item,
        price: item.price ?? 0,
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
  const userId = useAuthStore((s) => s.user?.user_id);
  return useMutation({
    mutationFn: async (payload: AddItemPayload): Promise<InventoryItem> => {
  const { data } = await api.post<ApiResponse<InventoryItem>>("/inventory", {
    product_name: payload.name,
    current_stock: payload.stock,
    min_threshold: payload.min_stock,
    category: payload.category,
    unit: payload.unit,
    price: payload.price,
    user_id: userId,
  });

  // Kalau data.data null, fallback ke payload
  if (!data.data) {
    return {
      id: crypto.randomUUID(),
      name: payload.name,
      stock: payload.stock,
      min_stock: payload.min_stock,
      category: payload.category,
      unit: payload.unit,
      price: payload.price,
      status: "in_stock" as InventoryStatus,
      last_updated: new Date().toISOString(),
    };
  }
      
    const item = data.data as unknown as { 
    id: string; 
    product_name?: string;
    name?: string; 
    current_stock?: number;
    stock?: number;
    min_threshold?: number;
    min_stock?: number;
    category?: string; 
    unit?: string; 
    price?: number 
  };

  return {
    id: item.id,
    name: item.name ?? item.product_name ?? payload.name,
    stock: item.stock ?? item.current_stock ?? payload.stock,
    min_stock: item.min_stock ?? item.min_threshold ?? payload.min_stock,
    category: item.category ?? payload.category,
    unit: item.unit ?? payload.unit,
    price: item.price ?? payload.price,
    status: "in_stock" as InventoryStatus,
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
      const patchBody: Record<string, unknown> = { current_stock: payload.stock ?? 0 };
      if (payload.price !== undefined) patchBody.price = payload.price;
      const { data } = await api.patch<ApiResponse<InventoryItem>>(
        `/inventory/${id}`,
        patchBody,
      );
      const item = data.data as unknown as { id: string; name: string; stock: number; min_stock: number; category: string; unit: string; price?: number };
      return {
        id: item.id,
        name: item.name,
        stock: item.stock,
        min_stock: item.min_stock,
        category: item.category,
        unit: item.unit,
        price: item.price ?? 0,
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

export function useSellerInventory(sellerId: string) {
  return useQuery({
    queryKey: ["seller-inventory", sellerId],
    queryFn: async (): Promise<InventoryItem[]> => {
      if (!sellerId) return [];
      type BackendItem = { id: string; name: string; stock: number; min_stock: number; category: string; unit: string; price?: number };
      const { data } = await api.get<ApiResponse<BackendItem[]>>(`/inventory/seller/${sellerId}`);
      return (data.data || []).map((item) => ({
        ...item,
        price: item.price ?? 0,
        status: item.stock === 0 ? "out_of_stock" : item.stock < item.min_stock ? "low_stock" : "in_stock",
        last_updated: new Date().toISOString(),
      }));
    },
    enabled: !!sellerId,
    staleTime: 30 * 1000,
  });
}
