"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Clock3, Download, FileText, Loader2, MapPin, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LegacyDialog as Dialog } from "@/components/ui/dialog";
import { usePartnershipRequests, useRespondPartnership } from "@/hooks/useSuppliers";

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatValidUntil(ts: number) {
  if (!ts || ts === 0) return null;
  try {
    return new Date(ts * 1000).toLocaleDateString("en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

function downloadMou(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename || "mou-document.pdf";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function PartnershipRequestsPanel() {
  const { data, isLoading } = usePartnershipRequests("pending");
  const respond = useRespondPartnership();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewerRequestId, setViewerRequestId] = useState<string | null>(null);

  const requests = data?.requests ?? [];
  const viewerRequest = requests.find((req) => req.request_id === viewerRequestId) ?? null;

  const toggle = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader className="space-y-3 border-b border-[#E2E8F0] pb-4">
        <div className="flex items-center justify-between">
          <Badge tone="info" className="w-fit">
            From Distributors
          </Badge>
          {requests.length > 0 && (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F59E0B] text-xs font-semibold text-white">
              {requests.length}
            </span>
          )}
        </div>
        <CardTitle className="text-base">Distributor Requests</CardTitle>
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
            <p className="text-sm text-[#64748B]">No incoming requests.</p>
          </div>
        )}

        {!isLoading &&
          requests.map((req) => {
            const isActing =
              respond.isPending && respond.variables?.request_id === req.request_id;
            const isOpen = expandedId === req.request_id;
            const hasMou = !!(req.terms || req.distribution_region || req.valid_until || req.mou_document_data);
            const validUntil = formatValidUntil(req.valid_until ?? 0);

            return (
              <div key={req.request_id} className="flex flex-col gap-3 px-5 py-4">
                <button
                  type="button"
                  className="flex items-start justify-between gap-3 text-left"
                  onClick={() => hasMou && toggle(req.request_id)}
                >
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-[#0F172A]">
                      {req.distributor.business_name || req.distributor.name || "Unknown"}
                    </p>
                    <p className="mt-0.5 text-xs text-[#64748B]">{formatDate(req.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasMou && (
                      <span className="text-[#94A3B8]">
                        {isOpen ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </span>
                    )}
                    <Badge tone="warning">Pending</Badge>
                  </div>
                </button>

                {isOpen && hasMou && (
                  <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-3">
                    {req.terms && (
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <FileText className="h-3.5 w-3.5 text-[#3B82F6]" />
                          <p className="text-xs font-semibold text-[#0F172A]">MOU Terms</p>
                        </div>
                        <p className="text-sm leading-relaxed text-[#475569]">{req.terms}</p>
                      </div>
                    )}

                    {req.distribution_region && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-[#3B82F6]" />
                        <p className="text-sm text-[#475569]">
                          <span className="text-xs text-[#94A3B8]">Distribution Region:</span>{" "}
                          {req.distribution_region}
                        </p>
                      </div>
                    )}

                    {validUntil && (
                      <div className="flex items-center gap-2">
                        <Clock3 className="h-3.5 w-3.5 text-[#3B82F6]" />
                        <p className="text-sm text-[#475569]">
                          <span className="text-xs text-[#94A3B8]">Valid Until:</span>{" "}
                          {validUntil}
                        </p>
                      </div>
                    )}

                    {req.legal_contract_hash && (
                      <div className="rounded-lg border border-[#DDD6FE] bg-[#F5F3FF] px-3 py-2">
                        <p className="text-xs text-[#64748B]">MOU Document Hash</p>
                        <p className="font-mono text-xs text-[#7C3AED] truncate">{req.legal_contract_hash}</p>
                      </div>
                    )}

                    {req.mou_document_data && (
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          className="flex-1 gap-2"
                          onClick={() => setViewerRequestId(req.request_id)}
                        >
                          <FileText className="h-4 w-4" />
                          View MOU
                        </Button>
                        <Button
                          variant="secondary"
                          className="gap-2"
                          onClick={() => downloadMou(req.mou_document_data ?? "", req.mou_document_name || "mou-document.pdf")}
                        >
                          <Download className="h-4 w-4" />
                          Download
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    className="flex-1 gap-1.5 bg-[#22C55E] text-sm hover:bg-green-600"
                    disabled={isActing}
                    onClick={() => respond.mutate({ request_id: req.request_id, action: "accept" })}
                  >
                    {isActing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    Accept
                  </Button>
                  <Button
                    variant="secondary"
                    className="flex-1 gap-1.5 text-sm text-[#EF4444] hover:bg-[#FEF2F2]"
                    disabled={isActing}
                    onClick={() => respond.mutate({ request_id: req.request_id, action: "reject" })}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Reject
                  </Button>
                </div>
              </div>
            );
          })}
      </CardContent>

      <Dialog
        open={!!viewerRequest}
        onClose={() => setViewerRequestId(null)}
        title={viewerRequest?.mou_document_name || "MOU Document"}
        description="Preview distributor MOU document."
        className="max-w-5xl"
      >
        {viewerRequest?.mou_document_data ? (
          <iframe
            src={viewerRequest.mou_document_data}
            title={viewerRequest.mou_document_name || "MOU Document"}
            className="h-[70vh] w-full rounded-xl border border-[#E2E8F0]"
          />
        ) : (
          <p className="text-sm text-[#64748B]">Document not available.</p>
        )}
      </Dialog>
    </Card>
  );
}
