"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";

// ─── Types ────────────────────────────────────────────────────────────────────

export type OrderStatus = "pending" | "processing" | "shipping" | "delivered" | "cancelled";
export type EscrowStatus = "held" | "released" | "refunded";

export type ShippingInfo = {
  courier: string;
  tracking_number: string;
  shipped_at: string;
  tracking_url?: string;
};

export type OrderParty = {
  id: string;
  name: string;
  role: "supplier" | "distributor" | "retailer";
};

export type OrderItem = {
  item_name: string;
  qty: number;
  unit: string;
  price_per_unit: number;
  subtotal: number;
};

export type StatusHistoryEntry = {
  status: OrderStatus;
  changed_at: string;
};

export type Order = {
  order_id: string;
  order_number: string;
  buyer: OrderParty;
  seller: OrderParty;
  items: OrderItem[];
  total_amount: number;
  status: OrderStatus;
  escrow_status: EscrowStatus;
  delivery_address: string;
  estimated_delivery: string;
  shipping_info?: ShippingInfo;
  created_at: string;
  updated_at: string;
};

export type OrderDetail = Order & {
  notes: string | null;
  status_history: StatusHistoryEntry[];
};

export type OrdersResponse = {
  orders: Order[];
  summary: {
    total_orders: number;
    active_orders: number;
    pending_orders: number;
    completed_orders: number;
    cancelled_orders: number;
  };
  fulfillment_metrics?: {
    avg_processing_hours: number;
    completion_rate: number;
    delayed_count: number;
    on_time_rate: number;
  };
  pagination: { page: number; limit: number; total: number };
};

export type CreateOrderPayload = {
  seller_id: string;
  seller_type: "supplier" | "distributor";
  seller_name?: string;
  buyer_id: string;
  buyer_name: string;
  buyer_role: "distributor" | "retailer";
  items: {
    item_name: string;
    qty: number;
    unit: string;
    price_per_unit: number;
  }[];
  delivery_address: string;
  notes?: string;
};

export type CreateOrderResponse = {
  order_id: string;
  order_number: string;
  total_amount: number;
  status: OrderStatus;
  escrow_status: EscrowStatus;
  created_at: string;
};

type OrderFilters = {
  status?: OrderStatus;
  role?: "buyer" | "seller";
  page?: number;
  limit?: number;
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useOrders(filters: OrderFilters = {}) {
  const userId = useAuthStore((s) => s.user?.user_id);
  return useQuery({
    queryKey: ["orders", filters, userId],
    queryFn: async (): Promise<OrdersResponse> => {
      const params = new URLSearchParams();
      if (filters.status) params.set("status", filters.status);
      if (filters.role) params.set("role", filters.role);
      if (userId) params.set("user_id", userId);
      if (filters.page) params.set("page", String(filters.page));
      if (filters.limit) params.set("limit", String(filters.limit));
      const { data } = await api.get<ApiResponse<OrdersResponse>>(
        `/orders?${params.toString()}`,
      );
      return data.data;
    },
    staleTime: 30 * 1000,
    refetchInterval: 5 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useOrderDetail(orderId: string | null) {
  return useQuery({
    queryKey: ["orders", orderId],
    queryFn: async (): Promise<OrderDetail> => {
      const { data } = await api.get<ApiResponse<OrderDetail>>(`/orders/${orderId}`);
      return data.data;
    },
    enabled: !!orderId,
    staleTime: 30 * 1000,
    refetchInterval: orderId ? 5 * 1000 : false,
    refetchOnWindowFocus: true,
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateOrderPayload): Promise<CreateOrderResponse> => {
      const { data } = await api.post<ApiResponse<CreateOrderResponse>>("/orders", payload);
      if (!data.success) throw { response: { data } };
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

export type OrdersTrustSummary = {
  escrow_held: number;
  escrow_released: number;
  escrow_refunded: number;
  total_released_value: number;
  reputation_score: number;
};

export function useOrdersTrustSummary() {
  const user = useAuthStore((s) => s.user);
  const userId = user?.user_id;
  const role = user?.role;
  return useQuery({
    queryKey: ["orders", "trust-summary", userId],
    queryFn: async (): Promise<OrdersTrustSummary> => {
      const params = new URLSearchParams();
      if (userId) params.set("user_id", userId);
      if (role) params.set("role", role);
      const { data } = await api.get<ApiResponse<OrdersTrustSummary>>(
        `/orders/trust-summary?${params.toString()}`,
      );
      return data.data;
    },
    enabled: !!userId,
    staleTime: 30 * 1000,
    refetchInterval: 5 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderId,
      status,
      shipping_info,
    }: {
      orderId: string;
      status: OrderStatus;
      shipping_info?: ShippingInfo;
    }): Promise<{ order_id: string; status: OrderStatus; updated_at: string }> => {
      const { data } = await api.put<
        ApiResponse<{ order_id: string; status: OrderStatus; updated_at: string }>
      >(`/orders/${orderId}/status`, { status, ...(shipping_info && { shipping_info }) });
      if (!data.success || !data.data) {
        throw new Error(data.message || "Failed to update order status.");
      }
      return data.data;
    },
    onSuccess: (_data, { orderId }) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["orders", orderId] });
      qc.invalidateQueries({ queryKey: ["orders", "trust-summary"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { data } = await api.post<ApiResponse>(`/orders/${orderId}/cancel`);
      if (!data.success) throw new Error(data.message || "Failed to cancel order.");
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["orders", "trust-summary"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}
