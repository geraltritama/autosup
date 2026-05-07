"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";

export type ShipmentStatus = "packed" | "dispatched" | "in_transit" | "delivered" | "delayed" | "failed";

export type Shipment = {
  id: string;
  order_id: string;
  retailer_name: string;
  destination: string;
  status: ShipmentStatus;
  eta: string;
  carrier: string;
};

export type LogisticsPartner = {
  id: string;
  name: string;
  reliability_score: number;
  active_shipments: number;
};

export type LogisticsResponse = {
  active_shipments: number;
  delayed_shipments: number;
  delivered_today: number;
  shipments: Shipment[];
  partners: LogisticsPartner[];
};

export type OptimizeRouteResult = {
  shipment_id: string;
  new_eta: string;
  optimized: boolean;
};

export function useOptimizeRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (shipment_id: string): Promise<OptimizeRouteResult> => {
      const { data } = await api.put<ApiResponse<OptimizeRouteResult>>(
        `/logistics/shipments/${shipment_id}/route`,
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["logistics"] });
    },
  });
}

export function useLogistics() {
  const userId = useAuthStore((s) => s.user?.user_id);
  return useQuery({
    queryKey: ["logistics", userId],
    queryFn: async (): Promise<LogisticsResponse> => {
      const params = userId ? `?user_id=${userId}` : "";
      const { data } = await api.get<ApiResponse<LogisticsResponse>>(`/logistics/shipments${params}`);
      return data.data;
    },
    staleTime: 60 * 1000,
  });
}
