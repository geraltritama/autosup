"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CreditAccountStatus = "active" | "overdue" | "suspended" | "closed";
export type RiskLevel = "low" | "medium" | "high";
export type RepaymentStatus = "paid" | "overdue" | "partial" | "failed";

export type CreditAccount = {
  credit_account_id: string;
  retailer: { retailer_id: string; name: string };
  credit_limit: number;
  utilized_amount: number;
  available_amount: number;
  utilization_pct: number;
  status: CreditAccountStatus;
  risk_level: RiskLevel;
  next_due_date: string;
  next_due_amount: number;
  opened_at: string;
};

export type CreditAccountsResponse = {
  accounts: CreditAccount[];
  summary: {
    total_credit_issued: number;
    total_utilized: number;
    total_available: number;
    overdue_count: number;
    avg_utilization_pct: number;
  };
  pagination: { page: number; limit: number; total: number };
};

export type Repayment = {
  repayment_id: string;
  amount: number;
  paid_at: string;
  status: RepaymentStatus;
  payment_method: string;
  invoice_id: string;
};

export type CreditRiskResult = {
  retailer_id: string;
  retailer_name: string;
  risk_score: number;
  risk_level: RiskLevel;
  recommendation: string;
  max_credit_suggestion: number;
  generated_at: string;
};

export type OpenCreditPayload = {
  retailer_id: string;
  credit_limit: number;
  billing_cycle_days: number;
  notes?: string;
};

type CreditFilters = {
  status?: CreditAccountStatus;
  retailer_id?: string;
};

// ─── Mock data ────────────────────────────────────────────────────────────────

const mockAccounts: CreditAccount[] = [
  {
    credit_account_id: "credit-uuid-001",
    retailer: { retailer_id: "retailer-uuid-001", name: "Toko Sumber Rejeki" },
    credit_limit: 10000000,
    utilized_amount: 3200000,
    available_amount: 6800000,
    utilization_pct: 32,
    status: "active",
    risk_level: "low",
    next_due_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    next_due_amount: 1500000,
    opened_at: "2026-01-15T08:00:00Z",
  },
  {
    credit_account_id: "credit-uuid-002",
    retailer: { retailer_id: "retailer-uuid-003", name: "Restoran Padang Jaya" },
    credit_limit: 15000000,
    utilized_amount: 9800000,
    available_amount: 5200000,
    utilization_pct: 65,
    status: "active",
    risk_level: "medium",
    next_due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    next_due_amount: 2800000,
    opened_at: "2025-11-20T08:00:00Z",
  },
  {
    credit_account_id: "credit-uuid-003",
    retailer: { retailer_id: "retailer-uuid-005", name: "Nusantara Coffee Shop" },
    credit_limit: 5000000,
    utilized_amount: 4900000,
    available_amount: 100000,
    utilization_pct: 98,
    status: "overdue",
    risk_level: "high",
    next_due_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    next_due_amount: 1200000,
    opened_at: "2026-02-10T08:00:00Z",
  },
];

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useCreditAccounts(filters: CreditFilters = {}) {
  return useQuery({
    queryKey: ["credit", "accounts", filters],
    queryFn: async (): Promise<CreditAccountsResponse> => {
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 450));
        let list = [...mockAccounts];
        if (filters.status) list = list.filter((a) => a.status === filters.status);
        if (filters.retailer_id)
          list = list.filter((a) => a.retailer.retailer_id === filters.retailer_id);
        return {
          accounts: list,
          summary: {
            total_credit_issued: mockAccounts.reduce((s, a) => s + a.credit_limit, 0),
            total_utilized: mockAccounts.reduce((s, a) => s + a.utilized_amount, 0),
            total_available: mockAccounts.reduce((s, a) => s + a.available_amount, 0),
            overdue_count: mockAccounts.filter((a) => a.status === "overdue").length,
            avg_utilization_pct: Math.round(
              mockAccounts.reduce((s, a) => s + a.utilization_pct, 0) / mockAccounts.length,
            ),
          },
          pagination: { page: 1, limit: 20, total: list.length },
        };
      }
      const params = new URLSearchParams();
      if (filters.status) params.set("status", filters.status);
      if (filters.retailer_id) params.set("retailer_id", filters.retailer_id);
      const userId = useAuthStore.getState().user?.user_id;
      if (userId) params.set("user_id", userId);
      const { data } = await api.get<ApiResponse<CreditAccountsResponse>>(
        `/credit/accounts?${params.toString()}`,
      );
      return data.data;
    },
    staleTime: 30 * 1000,
  });
}

export function useCreditRepayments(creditAccountId: string | null) {
  return useQuery({
    queryKey: ["credit", "repayments", creditAccountId],
    queryFn: async (): Promise<Repayment[]> => {
      const { data } = await api.get<ApiResponse<{ repayments: Repayment[] }>>(
        `/credit/accounts/${creditAccountId}/repayments`,
      );
      return data.data.repayments;
    },
    enabled: !!creditAccountId,
    staleTime: 30 * 1000,
  });
}

export function useAiCreditRisk() {
  return useMutation({
    mutationFn: async (retailer_id: string): Promise<CreditRiskResult> => {
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 1200));
        const retailerNames: Record<string, string> = {
          "retailer-uuid-001": "Toko Sumber Rejeki",
          "retailer-uuid-003": "Restoran Padang Jaya",
          "retailer-uuid-005": "Nusantara Coffee Shop",
        };
        const riskMap: Record<string, { score: number; level: RiskLevel; max: number }> = {
          "retailer-uuid-001": { score: 78, level: "low", max: 10000000 },
          "retailer-uuid-003": { score: 55, level: "medium", max: 8000000 },
          "retailer-uuid-005": { score: 30, level: "high", max: 3000000 },
        };
        const r = riskMap[retailer_id] ?? { score: 65, level: "medium" as RiskLevel, max: 5000000 };
        return {
          retailer_id,
          retailer_name: retailerNames[retailer_id] ?? "Unknown",
          risk_score: r.score,
          risk_level: r.level,
          recommendation:
            r.level === "low"
              ? "This retailer has a consistent payment history. It is safe to provide credit."
              : r.level === "medium"
                ? "Extra monitoring needed. Consider a moderate limit and monitor repayments monthly."
                : "High risk detected. It is recommended not to extend credit or limit it very strictly.",
          max_credit_suggestion: r.max,
          generated_at: new Date().toISOString(),
        };
      }
      const { data } = await api.post<ApiResponse<CreditRiskResult>>("/ai/credit-risk", {
        retailer_id,
      });
      return data.data;
    },
  });
}

export function useOpenCreditAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: OpenCreditPayload): Promise<CreditAccount> => {
      const { data } = await api.post<ApiResponse<CreditAccount>>("/credit/accounts", payload);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["credit"] }),
  });
}

export function useUpdateCreditAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      creditAccountId,
      body,
    }: {
      creditAccountId: string;
      body: { credit_limit?: number; status?: CreditAccountStatus };
    }): Promise<CreditAccount> => {
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 600));
        const idx = mockAccounts.findIndex((a) => a.credit_account_id === creditAccountId);
        if (idx === -1) throw new Error("Credit account not found");
        if (body.credit_limit !== undefined) {
          mockAccounts[idx].credit_limit = body.credit_limit;
          mockAccounts[idx].available_amount = body.credit_limit - mockAccounts[idx].utilized_amount;
          mockAccounts[idx].utilization_pct = Math.round(
            (mockAccounts[idx].utilized_amount / body.credit_limit) * 100,
          );
        }
        if (body.status) mockAccounts[idx].status = body.status;
        return mockAccounts[idx];
      }
      const { data } = await api.put<ApiResponse<CreditAccount>>(
        `/credit/accounts/${creditAccountId}`,
        body,
      );
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["credit"] }),
  });
}
