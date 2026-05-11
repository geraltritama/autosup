"use client";


import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  Clock3,
  CreditCard,
  Loader2,
  PieChart,
  Wallet,
} from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { InsightCard } from "@/components/dashboard/insight-card";
import { PageErrorState } from "@/components/dashboard/page-error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRetailerPayments, usePayInvoice, useDistributorPayments, useSettlePayment } from "@/hooks/usePayment";
import { useAuthStore } from "@/store/useAuthStore";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

const statusTone = { draft: "neutral", sent: "info", pending: "warning", paid: "success", overdue: "danger", cancelled: "danger" } as const;
const statusLabel = { draft: "Draft", sent: "Sent", pending: "Unpaid", paid: "Paid", overdue: "Overdue", cancelled: "Cancelled" } as const;
const distStatusTone = { pending: "warning", settled: "success", processing: "info" } as const;
const distStatusLabel = { pending: "Pending", settled: "Settled", processing: "Processing" } as const;

export default function PaymentPage() {
  const role = useAuthStore((s) => s.user?.role);
  const retailerQuery = useRetailerPayments();
  const distributorQuery = useDistributorPayments();
  const { data, isLoading, isError, refetch } = role === "distributor" ? distributorQuery : retailerQuery;
  const payMutation = usePayInvoice();
  const settleMutation = useSettlePayment();

  if (role !== "retailer" && role !== "distributor") {
    return (
      <main className="flex h-[80vh] items-center justify-center p-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-[#0F172A]">Access Denied</h2>
          <p className="mt-2 text-sm text-[#64748B]">This Payment page is for Retailers or Distributors only.</p>
        </div>
      </main>
    );
  }

  const retailerData = role === "retailer" ? retailerQuery.data : undefined;
  const distData = role === "distributor" ? distributorQuery.data : undefined;
  const summary = retailerData?.summary;
  const distSummary = distData?.summary;
  const invoices = retailerData?.invoices ?? [];
  const distPayments = distData?.payments ?? [];
  const insights = retailerData?.insights ?? [];

  const adaptedInsights = insights.map((i) => ({
    type: i.type,
    message: i.message,
    urgency: i.urgency,
    item_id: i.type,
  }));

  return (
    <main className="space-y-6 px-6 py-6 lg:px-8 lg:py-8">
      {/* Header */}
      <section className="flex flex-col gap-4 rounded-3xl border border-[#E2E8F0] bg-white px-6 py-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <Badge tone="info">Financial control</Badge>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-[#0F172A]">Payments & Credit</h1>
            <p className="max-w-3xl text-sm leading-7 text-[#64748B]">
              {role === "retailer"
                ? "Track invoices to distributors, leverage credit line facilities, and optimize spending with AI cash flow recommendations."
                : "Track incoming payments from retailers and outgoing to suppliers, and optimize cash flow with AI."}
            </p>
          </div>
        </div>
      </section>

      {/* KPI cards — retailer */}
      {role === "retailer" && summary && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Total Outstanding" value={formatCurrency(summary.total_outstanding)} meta="Outstanding debt" tone="warning" icon={Banknote} />
          <KpiCard label="Paid This Month" value={formatCurrency(summary.paid_this_month)} meta="Paid this month" tone="success" icon={CheckCircle2} />
          <KpiCard label="Total Invoices" value={String(summary.total_invoices)} meta="Total invoices" tone="info" icon={CreditCard} />
          <KpiCard label="Overdue" value={String(summary.overdue_count)} meta="Overdue invoices" tone="danger" icon={Clock3} />
        </section>
      )}

      {/* KPI cards — distributor */}
      {role === "distributor" && distSummary && (
        <section className="grid gap-4 md:grid-cols-3">
          <KpiCard label="Total Payable" value={formatCurrency(distSummary.total_payable)} meta="Outgoing payments" tone="warning" icon={ArrowUpRight} />
          <KpiCard label="Total Receivable" value={formatCurrency(distSummary.total_receivable)} meta="Incoming payments" tone="success" icon={ArrowDownLeft} />
          <KpiCard label="Pending" value={String(distSummary.pending_count)} meta="Awaiting settlement" tone="danger" icon={Clock3} />
        </section>
      )}

      {/* AI Insights */}
      {adaptedInsights.length > 0 && (
        <section>
          <InsightCard insights={adaptedInsights} />
        </section>
      )}

      {/* Main content */}
      <section className="grid gap-6 xl:grid-cols-[1.5fr_0.85fr]">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-[#0F172A]">
            {role === "distributor" ? "Payment Transactions" : "Distributor Invoices"}
          </h2>

          {isLoading ? (
            <div className="flex h-32 items-center justify-center rounded-2xl border border-[#E2E8F0] bg-white">
              <Loader2 className="h-5 w-5 animate-spin text-[#94A3B8]" />
            </div>
          ) : isError ? (
            <PageErrorState message="Failed to load payment data" onRetry={() => refetch()} />
          ) : role === "distributor" ? (
            distPayments.length === 0 ? (
              <div className="flex h-32 flex-col items-center justify-center rounded-2xl border border-[#E2E8F0] bg-white">
                <span className="text-sm font-medium text-[#0F172A]">No transactions</span>
              </div>
            ) : (
              <div className="grid gap-4">
                {distPayments.map((pmt) => (
                  <Card key={pmt.payment_id} className="rounded-2xl">
                    <CardContent className="flex items-center justify-between gap-4 p-5">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-full ${pmt.type === "receivable" ? "bg-green-50 text-[#22C55E]" : "bg-orange-50 text-[#F59E0B]"}`}>
                            {pmt.type === "receivable" ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                          </div>
                          <p className="text-sm font-semibold text-[#0F172A]">{pmt.counterpart_name}</p>
                          <Badge tone={distStatusTone[pmt.status]}>{distStatusLabel[pmt.status]}</Badge>
                        </div>
                        <p className="text-xl font-bold text-[#0F172A]">{formatCurrency(pmt.amount)}</p>
                        <div className="flex gap-4 text-xs text-[#64748B]">
                          <span>Order: {pmt.order_id}</span>
                          <span>{new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(pmt.created_at))}</span>
                        </div>
                      </div>
                      <div>
                        {pmt.status === "pending" ? (
                          <Button
                            onClick={() => settleMutation.mutate(pmt.payment_id)}
                            disabled={settleMutation.isPending && settleMutation.variables === pmt.payment_id}
                          >
                            {settleMutation.isPending && settleMutation.variables === pmt.payment_id && (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Settle
                          </Button>
                        ) : (
                          <Button variant="secondary" disabled>
                            {distStatusLabel[pmt.status]}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )
          ) : invoices.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center rounded-2xl border border-[#E2E8F0] bg-white">
              <span className="text-sm font-medium text-[#0F172A]">No active invoices</span>
              <span className="text-xs text-[#64748B]">All invoices from {role === "retailer" ? "distributor" : "supplier"} are paid.</span>
            </div>
          ) : (
            <div className="grid gap-4">
              {invoices.map((inv) => (
                <Card key={inv.invoice_id} className="rounded-2xl">
                  <CardContent className="flex items-center justify-between gap-4 p-5">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <p className="text-sm font-semibold text-[#0F172A]">{inv.seller_name}</p>
                        <Badge tone={statusTone[inv.status]}>{statusLabel[inv.status]}</Badge>
                      </div>
                      <p className="text-xl font-bold text-[#0F172A]">{formatCurrency(inv.amount)}</p>
                      <div className="flex gap-4 text-xs text-[#64748B]">
                        <span>Order ID: {inv.order_id}</span>
                        <span>
                          Jatuh tempo: {new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(inv.due_date))}
                        </span>
                      </div>
                    </div>
                    <div>
                      {inv.status !== "paid" ? (
                        <Button
                          onClick={() => payMutation.mutate(inv.invoice_id)}
                          disabled={payMutation.isPending}
                        >
                          {payMutation.isPending && payMutation.variables === inv.invoice_id && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Pay Now
                        </Button>
                      ) : (
                        <Button variant="secondary" disabled>
                          Already Paid
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Side panel */}
        <div className="space-y-6">
          <Card className="rounded-2xl">
            <CardHeader className="space-y-1">
              <CardTitle className="text-base">
                {role === "distributor" ? "Settlement Summary" : "Credit & Financing Panel"}
              </CardTitle>
              <p className="text-sm text-[#64748B]">
                {role === "distributor" ? "Payment status summary" : "Credit facility from distributor partners"}
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {role === "distributor" && distSummary && (
                <>
                  <div className="rounded-xl border border-[#E2E8F0] p-4">
                    <p className="text-xs uppercase tracking-[0.15em] text-[#64748B]">Total Receivable</p>
                    <p className="mt-1 text-2xl font-semibold text-[#22C55E]">{formatCurrency(distSummary.total_receivable)}</p>
                  </div>
                  <div className="rounded-xl border border-[#E2E8F0] p-4">
                    <p className="text-xs uppercase tracking-[0.15em] text-[#64748B]">Total Payable</p>
                    <p className="mt-1 text-2xl font-semibold text-[#F59E0B]">{formatCurrency(distSummary.total_payable)}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.15em] text-[#64748B]">Pending</p>
                    <p className="mt-1 text-2xl font-semibold text-[#EF4444]">{distSummary.pending_count}</p>
                  </div>
                </>
              )}
              {summary && (
                <>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-[#0F172A]">Credit Utilization</span>
                      <span className="font-medium text-[#3B82F6]">{summary.total_invoices > 0 ? Math.round((summary.total_outstanding / (summary.total_outstanding + summary.paid_this_month || 1)) * 100) : 0}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[#E2E8F0]">
                      <div 
                        className="h-full bg-[#3B82F6] transition-all" 
                        style={{ width: `${summary.total_invoices > 0 ? Math.round((summary.total_outstanding / (summary.total_outstanding + summary.paid_this_month || 1)) * 100) : 0}%` }} 
                      />
                    </div>
                  </div>
                  
                  <div className="rounded-xl border border-[#E2E8F0] p-4">
                    <p className="text-xs uppercase tracking-[0.15em] text-[#64748B]">Total Invoices</p>
                    <p className="mt-1 text-2xl font-semibold text-[#0F172A]">{formatCurrency(summary.total_outstanding)}</p>
                  </div>
                </>
              )}

              <div className="rounded-xl bg-slate-50 p-4">
                <div className="flex gap-3">
                  <Wallet className="mt-0.5 h-5 w-5 text-[#64748B]" />
                  <div>
                    <p className="text-sm font-medium text-[#0F172A]">Payment Method</p>
                    <p className="mt-1 text-sm text-[#64748B]">Bank Transfer, E-Wallet, and Escrow connected and secured by the backend.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
