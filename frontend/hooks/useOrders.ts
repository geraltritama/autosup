"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";

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
  pagination: { page: number; limit: number; total: number };
};

export type CreateOrderPayload = {
  seller_id: string;
  seller_type: "supplier" | "distributor";
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
  return useQuery({
    queryKey: ["orders", filters],
    queryFn: async (): Promise<OrdersResponse> => {
      const params = new URLSearchParams();
      if (filters.status) params.set("status", filters.status);
      if (filters.role) params.set("role", filters.role);
      if (filters.page) params.set("page", String(filters.page));
      if (filters.limit) params.set("limit", String(filters.limit));
      const { data } = await api.get<ApiResponse<OrdersResponse>>(
        `/orders?${params.toString()}`,
      );
      return data.data;
    },
    staleTime: 30 * 1000,
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
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateOrderPayload): Promise<CreateOrderResponse> => {
      const { data } = await api.post<ApiResponse<CreateOrderResponse>>("/orders", payload);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
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
      return data.data;
    },
    onSuccess: (_data, { orderId }) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["orders", orderId] });
    },
  });
}
