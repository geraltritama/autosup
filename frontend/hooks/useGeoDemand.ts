"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";

export type RegionData = {
  region: string;
  demand_score: number;
  growth_pct: number;
};

export type GeoDemandResponse = {
  regions: RegionData[];
};

export function useGeoDemand(itemId?: string) {
  return useQuery({
    queryKey: ["geo-demand", itemId ?? "all"],
    queryFn: async (): Promise<GeoDemandResponse> => {
      const params = itemId ? `?item_id=${encodeURIComponent(itemId)}` : "";
      const { data } = await api.get<ApiResponse<GeoDemandResponse>>(
        `/analytics/supplier/regional${params}`,
      );
      return data.data;
    },
    staleTime: 60 * 1000,
  });
}
