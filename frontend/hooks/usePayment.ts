"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";

export type InvoiceStatus = "draft" | "sent" | "pending" | "paid" | "overdue" | "cancelled";

export type Invoice = {
  invoice_id: string;
  order_id: string;
  seller_name: string;
  amount: number;
  status: InvoiceStatus;
  due_date: string;
  created_at: string;
};

export type PaymentSummary = {
  total_outstanding: number;
  paid_this_month: number;
  available_credit: number;
  upcoming_due_payments: number;
  payment_success_rate: number;
  credit_utilization_pct: number;
};

export type CashFlowInsight = {
  type: string;
  message: string;
  urgency: "high" | "medium" | "low";
  actionable?: boolean;
};

export type RetailerPaymentResponse = {
  summary: PaymentSummary;
  invoices: Invoice[];
  insights: CashFlowInsight[];
};

export function useRetailerPayments() {
  const userId = useAuthStore((s) => s.user?.user_id);
  return useQuery({
    queryKey: ["retailer", "payments", userId],
    queryFn: async (): Promise<RetailerPaymentResponse> => {
      const params = userId ? `?user_id=${userId}` : "";
      const { data } = await api.get<ApiResponse<RetailerPaymentResponse>>(`/payments/retailer${params}`);
      return data.data;
    },
    staleTime: 60 * 1000,
  });
}

export type DistributorPaymentStatus = "pending" | "settled" | "processing";

export type DistributorPayment = {
  payment_id: string;
  counterpart_name: string;
  amount: number;
  type: "incoming" | "outgoing";
  status: DistributorPaymentStatus;
  order_id: string;
  created_at: string;
};

export type DistributorPaymentSummary = {
  total_incoming: number;
  total_outgoing: number;
  pending_settlements: number;
  net_flow: number;
};

export type DistributorPaymentResponse = {
  summary: DistributorPaymentSummary;
  payments: DistributorPayment[];
};

export function useDistributorPayments() {
  const userId = useAuthStore((s) => s.user?.user_id);
  return useQuery({
    queryKey: ["distributor", "payments", userId],
    queryFn: async (): Promise<DistributorPaymentResponse> => {
      const params = userId ? `?user_id=${userId}` : "";
      const { data } = await api.get<ApiResponse<DistributorPaymentResponse>>(`/payments/distributor${params}`);
      return data.data;
    },
    staleTime: 60 * 1000,
  });
}

export function useSettlePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payment_id: string) => {
      const { data } = await api.post<ApiResponse>("/payments/settle", { payment_id });
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["distributor", "payments"] });
    },
  });
}

export function usePayInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (invoice_id: string) => {
      const { data } = await api.post<ApiResponse>(`/invoices/${invoice_id}/pay`);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["retailer", "payments"] });
    },
  });
}
