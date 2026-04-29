"use client";

import { CheckCircle2, Clock3, Loader2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePartnershipRequests, useRespondPartnership } from "@/hooks/useSuppliers";

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}

const statusTone = { pending: "warning", accepted: "success", rejected: "neutral" } as const;
const statusLabel = { pending: "Menunggu", accepted: "Diterima", rejected: "Ditolak" } as const;

export function PartnershipRequestsPanel() {
  const { data, isLoading } = usePartnershipRequests();
  const respond = useRespondPartnership();

  const requests = data?.requests ?? [];

  return (
    <Card className="rounded-2xl">
      <CardHeader className="space-y-3 border-b border-[#E2E8F0] pb-4">
        <div className="flex items-center justify-between">
          <Badge tone="warning" className="w-fit">
            Partnership requests
          </Badge>
          {data && data.requests.filter((r) => r.status === "pending").length > 0 && (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F59E0B] text-xs font-semibold text-white">
              {data.requests.filter((r) => r.status === "pending").length}
            </span>
          )}
        </div>
        <CardTitle className="text-base">Permintaan Kemitraan Masuk</CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-[#E2E8F0] p-0">
        {isLoading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-[#94A3B8]" />
          </div>
        )}

        {!isLoading && requests.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Clock3 className="h-8 w-8 text-[#94A3B8]" />
            <p className="text-sm text-[#64748B]">Belum ada permintaan kemitraan masuk.</p>
          </div>
        )}

        {requests.map((req) => {
          const isPending = req.status === "pending";
          const isActing = respond.isPending && respond.variables?.request_id === req.request_id;

          return (
            <div key={req.request_id} className="flex flex-col gap-3 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#0F172A]">{req.distributor.business_name}</p>
                  <p className="mt-0.5 text-xs text-[#64748B]">{req.distributor.name}</p>
                  <p className="mt-1 text-xs text-[#94A3B8]">{formatDate(req.created_at)}</p>
                </div>
                <Badge tone={statusTone[req.status]}>{statusLabel[req.status]}</Badge>
              </div>

              {isPending && (
                <div className="flex gap-2">
                  <Button
                    className="gap-1.5 bg-[#22C55E] text-sm hover:bg-green-600"
                    disabled={isActing}
                    onClick={() => respond.mutate({ request_id: req.request_id, action: "accept" })}
                  >
                    {isActing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    Terima
                  </Button>
                  <Button
                    variant="secondary"
                    className="gap-1.5 text-sm text-[#EF4444] hover:bg-[#FEF2F2]"
                    disabled={isActing}
                    onClick={() => respond.mutate({ request_id: req.request_id, action: "reject" })}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Tolak
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
