"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";

export type AiAgentStatus = "active" | "paused" | "disabled";

export type AgentKey =
  | "demand_forecast"
  | "auto_restock"
  | "credit_risk"
  | "logistics_optimization"
  | "supplier_recommendation"
  | "price_optimization"
  | "cash_flow_optimizer"
  | "retailer_reorder"
  | "retailer_sales_trend"
  | "retailer_demand_insight";

export type AiAgent = {
  id: string;
  agent_key: AgentKey;
  name: string;
  description: string;
  status: AiAgentStatus;
  automation_level: "manual_approval" | "auto_with_threshold" | "auto_execute";
  recent_action: string;
  last_active: string;
};

export type AiActivity = {
  id: string;
  agent_name: string;
  action: string;
  impact: string;
  full_result?: string;
  timestamp: string;
};

export type AiPerformance = {
  accuracy_rate: number;
  cost_savings: number;
  time_saved_hours: number;
};

export type AiAgentsResponse = {
  agents: AiAgent[];
  activities: AiActivity[];
  performance: AiPerformance;
};

export function useAiAgents() {
  const role = useAuthStore((s) => s.user?.role);
  const userId = useAuthStore((s) => s.user?.user_id);
  return useQuery({
    queryKey: ["ai-agents", role, userId],
    queryFn: async (): Promise<AiAgentsResponse> => {
      const params = new URLSearchParams();
      if (userId) params.set("user_id", userId);
      const { data } = await api.get<ApiResponse<AiAgentsResponse>>(`/ai/agents?${params.toString()}`, {
        headers: { "x-user-role": role ?? "distributor" },
      });
      return data.data;
    },
    staleTime: 60 * 1000,
  });
}

export function useUpdateAgentConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, automation_level }: { id: string; status?: AiAgentStatus; automation_level?: "manual_approval" | "auto_with_threshold" | "auto_execute" }) => {
      const { data } = await api.put<ApiResponse>(`/ai/agents/${id}/config`, { status, automation_level });
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-agents"] });
    },
  });
}

export type AgentResult = {
  agent_type: string;
  urgency_level: "HIGH" | "MEDIUM" | "LOW";
  role_scope_valid: boolean;
  inventory_status?: {
    total_products?: number;
    low_stock_products?: string[];
    low_stock_count?: number;
    [key: string]: unknown;
  };
  demand_analysis?: {
    top_requested_products?: string[];
    demand_trend?: string;
    detected_spikes?: string[];
    predicted_shortages?: string[];
    [key: string]: unknown;
  };
  shipment_analysis?: {
    total_shipments?: number;
    delayed_count?: number;
    on_time_rate?: number;
    [key: string]: unknown;
  };
  credit_analysis?: {
    total_accounts?: number;
    high_risk_count?: number;
    overdue_count?: number;
    [key: string]: unknown;
  };
  sales_analysis?: {
    trending_up?: string[];
    trending_down?: string[];
    [key: string]: unknown;
  };
  analysis: {
    issue_detected: string;
    reason: string;
    confidence_score: number;
  };
  recommended_action: {
    action_type: string;
    [key: string]: unknown;
  };
  system_flags: {
    requires_human_approval: boolean;
    auto_execute_allowed: boolean;
  };
};

export type RunAgentResult = {
  agent_key: string;
  result: AgentResult;
  activity_id: string;
};

export function useRunAgent() {
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const userId = useAuthStore((s) => s.user?.user_id);
  return useMutation({
    mutationFn: async (agent_key: string): Promise<RunAgentResult> => {
      const params = userId ? `?user_id=${userId}` : "";
      const { data } = await api.post<ApiResponse<RunAgentResult>>(`/ai/agents/${agent_key}/run${params}`, null, {
        headers: { "x-user-role": role ?? "distributor" },
      });
      if (!data.success) throw new Error(data.message || "Agent execution failed");
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-agents"] });
    },
    onError: () => {
      qc.invalidateQueries({ queryKey: ["ai-agents"] });
    },
  });
}

export type AutoTickResult = {
  ticked: number;
  results: { agent_key: string; status: string; summary?: string; error?: string }[];
};

export function useAutoTickAgents() {
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const userId = useAuthStore((s) => s.user?.user_id);
  return useMutation({
    mutationFn: async (): Promise<AutoTickResult> => {
      const params = userId ? `?user_id=${userId}` : "";
      const { data } = await api.post<ApiResponse<AutoTickResult>>(`/ai/agents/auto-tick${params}`, null, {
        headers: { "x-user-role": role ?? "distributor" },
      });
      if (!data.success) throw new Error(data.message || "Auto-tick failed");
      return data.data;
    },
    onSuccess: (result) => {
      if (result.ticked > 0) {
        qc.invalidateQueries({ queryKey: ["ai-agents"] });
      }
    },
    onError: () => {
      // Silently retry on next interval
    },
  });
}

export function useClearActivities() {
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.delete<ApiResponse>("/ai/activities", {
        headers: { "x-user-role": role ?? "distributor" },
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-agents"] });
    },
  });
}
