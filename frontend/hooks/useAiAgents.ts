"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";

export type AiAgentStatus = "active" | "paused" | "disabled";

export type AgentKey =
  | "demand_forecast"
  | "auto_restock"
  | "credit_risk"
  | "logistics_optimization"
  | "supplier_recommendation"
  | "price_optimization"
  | "cash_flow_optimizer";

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
  return useQuery({
    queryKey: ["ai-agents"],
    queryFn: async (): Promise<AiAgentsResponse> => {
      const { data } = await api.get<ApiResponse<AiAgentsResponse>>("/ai/agents");
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
