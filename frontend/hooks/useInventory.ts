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
  demand_level?: "high" | "normal" | "low";
};

export type InventoryResponse = {
  items: InventoryItem[];
  summary: {
    total_items: number;
    low_stock_count: number;
    out_of_stock_count: number;
  };
  insight?: string;
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

export type InventoryImportRow = {
  name: string;
  category: string;
  stock: number;
  min_stock: number;
  unit: string;
  price: number;
};

export type InventoryImportResult = {
  created: number;
  updated: number;
  total: number;
};

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

const inventoryStatusOrder: Record<InventoryStatus, number> = {
  out_of_stock: 0,
  low_stock: 1,
  in_stock: 2,
};

function sortInventoryByPriority<T extends { status: InventoryStatus; name: string }>(items: T[]) {
  return [...items].sort(
    (a, b) =>
      inventoryStatusOrder[a.status] - inventoryStatusOrder[b.status] ||
      a.name.localeCompare(b.name),
  );
}

export function useInventory(filters: InventoryFilters = {}) {
  const userId = useAuthStore((s) => s.user?.user_id);
  return useQuery({
    queryKey: ["inventory", filters, userId],
    queryFn: async (): Promise<InventoryResponse> => {
      type BackendItem = { id: string; name: string; stock: number; min_stock: number; category: string; unit: string; price?: number; demand_level?: string; demand_order_count?: number };
      const params = new URLSearchParams();
      if (userId) params.set("user_id", userId);
      if (filters.search) params.set("search", filters.search);
      if (filters.category) params.set("category", filters.category);
      const qs = params.toString();
      const { data } = await api.get<ApiResponse<{ items: BackendItem[]; insight?: string } | BackendItem[]>>(`/inventory${qs ? `?${qs}` : ""}`);
      // Handle both old (array) and new (object with items) response shapes
      const raw = Array.isArray(data.data) ? data.data : (data.data?.items ?? []);
      const insight = Array.isArray(data.data) ? "" : (data.data?.insight ?? "");
      const allItems: InventoryItem[] = raw.map((item) => ({
        ...item,
        price: item.price ?? 0,
        status: item.stock === 0 ? "out_of_stock" : item.stock < item.min_stock ? "low_stock" : "in_stock",
        last_updated: new Date().toISOString(),
        demand_level: item.demand_level as "high" | "normal" | "low" | undefined,
      }));
      const filtered = allItems.filter((item) => {
        if (filters.search && !item.name.toLowerCase().includes(filters.search.toLowerCase())) return false;
        if (filters.status && item.status !== filters.status) return false;
        if (filters.category && !item.category.toLowerCase().includes(filters.category.toLowerCase())) return false;
        return true;
      });
      const sorted = sortInventoryByPriority(filtered);
      return {
        items: sorted,
        summary: {
          total_items: allItems.length,
          low_stock_count: allItems.filter((i) => i.status === "low_stock").length,
          out_of_stock_count: allItems.filter((i) => i.status === "out_of_stock").length,
        },
        insight,
        pagination: { page: 1, limit: sorted.length, total: sorted.length },
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
      if (payload.name !== undefined) patchBody.product_name = payload.name;
      if (payload.price !== undefined) patchBody.price = payload.price;
      if (payload.min_stock !== undefined) patchBody.min_threshold = payload.min_stock;
      if (payload.category !== undefined) patchBody.category = payload.category;
      if (payload.unit !== undefined) patchBody.unit = payload.unit;
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

export function useImportInventory() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.user_id);

  return useMutation({
    mutationFn: async (rows: InventoryImportRow[]): Promise<InventoryImportResult> => {
      if (!userId) {
        throw new Error("User not found.");
      }

      type BackendItem = {
        id: string;
        name: string;
        stock: number;
        min_stock: number;
        category: string;
        unit: string;
        price?: number;
      };

      const { data } = await api.get<ApiResponse<BackendItem[]>>(`/inventory?user_id=${userId}`);
      const existingItems = data.data ?? [];
      const existingByName = new Map(
        existingItems.map((item) => [item.name.trim().toLowerCase(), item]),
      );

      let created = 0;
      let updated = 0;

      for (const row of rows) {
        const existing = existingByName.get(row.name.trim().toLowerCase());
        if (existing) {
          await api.patch(`/inventory/${existing.id}`, {
            product_name: row.name,
            current_stock: row.stock,
            min_threshold: row.min_stock,
            category: row.category,
            unit: row.unit,
            price: row.price,
          });
          updated += 1;
          continue;
        }

        await api.post("/inventory", {
          product_name: row.name,
          current_stock: row.stock,
          min_threshold: row.min_stock,
          category: row.category,
          unit: row.unit,
          price: row.price,
          user_id: userId,
        });
        created += 1;
      }

      return {
        created,
        updated,
        total: rows.length,
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
      const mapped = (data.data || []).map((item): InventoryItem => ({
        ...item,
        price: item.price ?? 0,
        status: item.stock === 0 ? "out_of_stock" : item.stock < item.min_stock ? "low_stock" : "in_stock",
        last_updated: new Date().toISOString(),
      }));
      return sortInventoryByPriority(mapped);
    },
    enabled: !!sellerId,
    staleTime: 30 * 1000,
  });
}
