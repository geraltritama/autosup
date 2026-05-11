"use client";

import { useState } from "react";
import { useScrollLock } from "@/hooks/useScrollLock";
import {
  Building2,
  Loader2,
  Plus,
  Search,
  Users,
  AlertTriangle,
  TrendingUp,
  X,
  Trash2,
} from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { PageErrorState } from "@/components/dashboard/page-error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useRetailers,
  useAddRetailer,
  useRetailerDetail,
  useDeleteRetailerPartnership,
  type RetailerSegment,
  type RetailerStatus,
} from "@/hooks/useRetailers";
import { useAuthStore } from "@/store/useAuthStore";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
    notation: "compact",
  }).format(amount);
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

const segmentTone: Record<RetailerSegment, "info" | "success" | "warning"> = {
  premium: "success",
  regular: "info",
  new: "warning",
};

const statusTone: Record<RetailerStatus, "success" | "neutral" | "danger"> = {
  active: "success",
  inactive: "neutral",
  high_risk: "danger",
};

const segmentLabel: Record<RetailerSegment, string> = {
  premium: "Premium",
  regular: "Regular",
  new: "New",
};

const statusLabel: Record<RetailerStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  high_risk: "High Risk",
};

function AddRetailerDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const addRetailer = useAddRetailer();
  const [form, setForm] = useState({
    name: "",
    contact_person: "",
    phone: "",
    email: "",
    city: "",
    address: "",
    segment: "regular" as RetailerSegment,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    addRetailer.mutate(form, {
      onSuccess: () => {
        setForm({
          name: "",
          contact_person: "",
          phone: "",
          email: "",
          city: "",
          address: "",
          segment: "regular",
        });
        onClose();
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Retailer</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Store Name</Label>
            <Input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Store Name"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Contact Person</Label>
              <Input
                required
                value={form.contact_person}
                onChange={(e) => setForm((f) => ({ ...f, contact_person: e.target.value }))}
                placeholder="Contact Person"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone Number</Label>
              <Input
                required
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="08123456789"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="toko@email.com"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input
                required
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                placeholder="Jakarta"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Segment</Label>
              <Select
                value={form.segment}
                onValueChange={(v) => setForm((f) => ({ ...f, segment: v as RetailerSegment }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="regular">Regular</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Address</Label>
            <Input
              required
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="123 Main Street"
            />
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={addRetailer.isPending}>
              {addRetailer.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Add Retailer
          </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RetailerDetailPanel({
  retailerId,
  onClose,
}: {
  retailerId: string;
  onClose: () => void;
}) {
  const { data, isLoading } = useRetailerDetail(retailerId);

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-[#E2E8F0] bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
        <h3 className="font-semibold text-[#0F172A]">Detail Retailer</h3>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-[#64748B] hover:bg-slate-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-[#94A3B8]" />
        </div>
      ) : !data ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-[#64748B]">No data found.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Basic info */}
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-xl font-semibold text-[#0F172A]">{data.name}</h2>
              <div className="flex gap-2 flex-shrink-0">
                <Badge tone={segmentTone[data.segment]}>{segmentLabel[data.segment]}</Badge>
                <Badge tone={statusTone[data.status]}>{statusLabel[data.status]}</Badge>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[#64748B]">Contact</p>
                <p className="font-medium text-[#0F172A]">{data.contact_person}</p>
              </div>
              <div>
                <p className="text-[#64748B]">Phone</p>
                <p className="font-medium text-[#0F172A]">{data.phone}</p>
              </div>
              <div>
                <p className="text-[#64748B]">Email</p>
                <p className="font-medium text-[#0F172A]">{data.email}</p>
              </div>
              <div>
                <p className="text-[#64748B]">City</p>
                <p className="font-medium text-[#0F172A]">{data.city}</p>
              </div>
            </div>
            <div className="text-sm">
              <p className="text-[#64748B]">Alamat</p>
              <p className="font-medium text-[#0F172A]">{data.address}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
              <p className="text-xs text-[#64748B]">Total Purchases</p>
              <p className="mt-1 text-lg font-semibold text-[#0F172A]">
                {formatCurrency(data.total_purchase_amount)}
              </p>
            </div>
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
              <p className="text-xs text-[#64748B]">Orders/Month</p>
              <p className="mt-1 text-lg font-semibold text-[#0F172A]">
                {data.monthly_order_volume}x
              </p>
            </div>
          </div>

          {/* Demand intelligence */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-[#0F172A]">Demand Intelligence</h4>
            <div className="rounded-xl border border-[#E2E8F0] p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[#64748B]">Order Frequency</span>
                <span className="font-medium text-[#0F172A]">
                  {data.demand_intelligence.order_frequency_per_month}x/month
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#64748B]">Forecast Growth</span>
                <span className="font-medium text-[#22C55E]">
                  +{data.demand_intelligence.forecast_growth_pct}%
                </span>
              </div>
              <div className="mt-2 border-t border-[#E2E8F0] pt-2">
                <p className="text-xs text-[#64748B] mb-1.5">Top Products (30d)</p>
                <div className="space-y-1">
                  {data.demand_intelligence.top_products.map((p, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-[#0F172A]">{p.item_name}</span>
                      <span className="text-[#64748B]">{p.qty_last_30d} {p.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Credit summary */}
          {data.credit_summary && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-[#0F172A]">Credit Line</h4>
              {!data.credit_summary ? (
                <div className="rounded-xl border border-[#E2E8F0] p-4 text-sm text-[#64748B]">
                  No credit line data.
                </div>
              ) : (
              <div className="rounded-xl border border-[#E2E8F0] p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#64748B]">Status</span>
                  <Badge tone={data.credit_summary.has_active_credit ? "success" : "neutral"}>
                    {data.credit_summary.has_active_credit ? "Active" : "None"}
                  </Badge>
                </div>
                {data.credit_summary.has_active_credit && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#64748B]">Limit</span>
                      <span className="font-medium text-[#0F172A]">
                        {formatCurrency(data.credit_summary.credit_limit)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#64748B]">Outstanding</span>
                      <span className="font-medium text-[#F59E0B]">
                        {formatCurrency(data.credit_summary.outstanding_balance)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#64748B]">Risk Level</span>
                      <Badge
                        tone={
                          data.credit_summary.risk_level === "low"
                            ? "success"
                            : data.credit_summary.risk_level === "medium"
                              ? "warning"
                              : "danger"
                        }
                      >
                        {data.credit_summary.risk_level}
                      </Badge>
                    </div>
                  </>
                )}
              </div>
              )}
            </div>
          )}

          {/* Purchase history */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-[#0F172A]">Order History</h4>
            {data.purchase_history.length === 0 ? (
              <p className="text-sm text-[#64748B]">No orders yet.</p>
            ) : (
              <div className="space-y-2">
                {data.purchase_history.map((o) => (
                  <div
                    key={o.order_id}
                    className="flex items-center justify-between rounded-xl border border-[#E2E8F0] px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-[#0F172A]">{o.order_number}</p>
                      <p className="text-xs text-[#64748B]">{formatDate(o.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-[#0F172A]">
                        {formatCurrency(o.total_amount)}
                      </p>
                      <Badge tone="success" className="mt-0.5 text-[10px]">
                        {o.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RetailersPage() {
  const role = useAuthStore((s) => s.user?.role);
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<RetailerSegment | "">("");
  const [status, setStatus] = useState<RetailerStatus | "">("");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  useScrollLock(!!selectedId);

  const { data, isLoading, isError, refetch } = useRetailers({
    search: search || undefined,
    segment: segment || undefined,
    status: status || undefined,
  });

  const deletePartnership = useDeleteRetailerPartnership();

  if (role !== "distributor") {
    return (
      <main className="flex h-[80vh] items-center justify-center p-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-[#0F172A]">Access Denied</h2>
          <p className="mt-2 text-sm text-[#64748B]">
            Retailers CRM page is for Distributors only.
          </p>
        </div>
      </main>
    );
  }

  const retailers = data?.retailers ?? [];
  const summary = data?.summary;

  return (
    <>
      <main className="space-y-6 px-6 py-6 lg:px-8 lg:py-8">
        {/* Header */}
        <section className="flex flex-col gap-4 rounded-3xl border border-[#E2E8F0] bg-white px-6 py-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <Badge tone="info">CRM</Badge>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-[#0F172A]">
                Retailers
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-[#64748B]">
                Manage and monitor retailers that are your distribution clients. View
                purchase history, demand intel, and credit status per retailer.
              </p>
            </div>
          </div>
          <Button onClick={() => setShowAdd(true)} className="gap-2 self-start lg:self-auto">
            <Plus className="h-4 w-4" />
            Add Retailer
          </Button>
        </section>

        {/* KPI */}
        {summary && (
          <section className="grid gap-4 md:grid-cols-3">
            <KpiCard
              label="Total Active"
              value={String(summary.active)}
              meta="Currently active retailers"
              tone="success"
              icon={Users}
            />
            <KpiCard
              label="Total Retailer"
              value={String(summary.total)}
              meta="All registered retailers"
              tone="info"
              icon={TrendingUp}
            />
            <KpiCard
              label="Premium"
              value={String(summary.premium_count)}
              meta="Premium segment retailers"
              tone="warning"
              icon={AlertTriangle}
            />
          </section>
        )}

        {/* Filters */}
        <section className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, city, contact..."
              className="pl-9"
            />
          </div>
          <Select
            value={segment || "all"}
            onValueChange={(v) => setSegment(v === "all" ? "" : (v as RetailerSegment))}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All Segments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Segments</SelectItem>
              <SelectItem value="premium">Premium</SelectItem>
              <SelectItem value="regular">Regular</SelectItem>
              <SelectItem value="new">New</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={status || "all"}
            onValueChange={(v) => setStatus(v === "all" ? "" : (v as RetailerStatus))}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="high_risk">High Risk</SelectItem>
            </SelectContent>
          </Select>
        </section>

        {/* List */}
        <section>
          {isError && !isLoading && (
            <PageErrorState
              message="Failed to load retailers data"
              onRetry={() => refetch()}
            />
          )}

          <Card className="rounded-2xl">
            <CardContent className="pt-6">
              {isLoading ? (
                <div className="flex h-[300px] items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-[#94A3B8]" />
                </div>
              ) : isError ? null : retailers.length === 0 ? (
                <div className="flex h-[300px] flex-col items-center justify-center gap-3">
                  <Building2 className="h-10 w-10 text-[#CBD5E1]" />
                  <p className="text-sm text-[#64748B]">No retailers found.</p>
                  <Button variant="outline" size="sm" onClick={() => setShowAdd(true)}>
                    Add First Retailer
                  </Button>
                </div>
              ) : (
                <div className="space-y-0">
                  {/* Header */}
                  <div className="grid grid-cols-12 gap-4 border-b border-[#E2E8F0] pb-3 text-xs uppercase tracking-wider text-[#64748B]">
                    <div className="col-span-3">Retailer</div>
                    <div className="col-span-2">Segment</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-2 text-right">Total Purchases</div>
                    <div className="col-span-2 text-right">Last Order</div>
                    <div className="col-span-1" />
                  </div>
                  {/* Rows */}
                  <div className="divide-y divide-[#E2E8F0]">
                    {retailers.map((r) => (
                      <button
                        key={r.retailer_id}
                        onClick={() =>
                          setSelectedId(
                            selectedId === r.retailer_id ? null : r.retailer_id,
                          )
                        }
                        className="grid w-full grid-cols-12 items-center gap-4 py-4 text-left transition-colors hover:bg-slate-50/50"
                      >
                        <div className="col-span-3 flex items-center gap-3">
                          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[#3B82F6]">
                            <Building2 className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-[#0F172A]">{r.name}</p>
                            <p className="text-xs text-[#64748B]">
                              {r.contact_person} · {r.city}
                            </p>
                          </div>
                        </div>
                        <div className="col-span-2">
                          <Badge tone={segmentTone[r.segment]}>{segmentLabel[r.segment]}</Badge>
                        </div>
                        <div className="col-span-2">
                          <Badge tone={statusTone[r.status]}>{statusLabel[r.status]}</Badge>
                        </div>
                        <div className="col-span-2 text-right text-sm font-medium text-[#0F172A]">
                          {formatCurrency(r.total_purchase_amount)}
                        </div>
                        <div className="col-span-2 text-right text-xs text-[#64748B]">
                          {formatDate(r.last_order_at)}
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <span
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget(r.retailer_id); }}
                            className="inline-flex cursor-pointer items-center justify-center rounded-lg p-2 text-[#EF4444] hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </main>

      {/* Side panel */}
      {selectedId && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/20"
            onClick={() => setSelectedId(null)}
          />
          <RetailerDetailPanel
            retailerId={selectedId}
            onClose={() => setSelectedId(null)}
          />
        </>
      )}

      <AddRetailerDialog open={showAdd} onClose={() => setShowAdd(false)} />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deletePartnership.mutate(deleteTarget, {
            onSuccess: () => setDeleteTarget(null),
          });
        }}
        title="End Partnership"
        description={`Are you sure you want to end the partnership with this retailer? This action cannot be undone.`}
        confirmLabel="End Partnership"
        isLoading={deletePartnership.isPending}
      />
    </>
  );
}
