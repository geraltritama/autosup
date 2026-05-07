"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";

export type RegionData = {
  region: string;
  demand_score: number;
  growth_pct: number;
};

export type GeoDemandResponse = {
  regions: RegionData[];
};

export function useGeoDemand(itemId?: string) {
  const userId = useAuthStore((s) => s.user?.user_id);
  return useQuery({
    queryKey: ["geo-demand", itemId ?? "all", userId],
    queryFn: async (): Promise<GeoDemandResponse> => {
      const params = new URLSearchParams();
      if (itemId) params.set("item_id", itemId);
      if (userId) params.set("user_id", userId);
      const qs = params.toString();
      const { data } = await api.get<ApiResponse<GeoDemandResponse>>(
        `/analytics/supplier/regional${qs ? `?${qs}` : ""}`,
      );
      return data.data;
    },
    staleTime: 60 * 1000,
  });
}
