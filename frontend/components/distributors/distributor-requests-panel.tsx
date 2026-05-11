"use client";
import { CheckCircle2, Clock3, Loader2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDistributorRequests, useRespondDistributorRequest } from "@/hooks/useDistributors";

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      day: "numeric", month: "short", year: "numeric",
    }).format(new Date(iso));
  } catch { return iso; }
}

export function DistributorRequestsPanel() {
  const { data, isLoading } = useDistributorRequests("pending");
  const respond = useRespondDistributorRequest();
  const requests = data?.requests ?? [];

  return (
    <Card className="rounded-2xl">
      <CardHeader className="space-y-3 border-b border-[#E2E8F0] pb-4">
        <div className="flex items-center justify-between">
          <Badge tone="success" className="w-fit">From Retailers</Badge>
          {requests.length > 0 && (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F59E0B] text-xs font-semibold text-white">
              {requests.length}
            </span>
          )}
        </div>
        <CardTitle className="text-base">Retailer Requests</CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-[#E2E8F0] p-0">
        {isLoading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-[#94A3B8]" />
          </div>
        )}
        {!isLoading && requests.length === 0 && (
          <p className="py-10 text-center text-sm text-[#94A3B8]">
            No incoming partnership requests.
          </p>
        )}
        {requests.map((req) => (
          <div key={req.request_id} className="flex items-center justify-between px-4 py-3">
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-[#0F172A]">
                {req.distributor.name}
              </p>
              <p className="flex items-center gap-1 text-xs text-[#94A3B8]">
                <Clock3 className="h-3 w-3" />
                {formatDate(req.created_at)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => respond.mutate({ request_id: req.request_id, action: "accept" })}
                disabled={respond.isPending}
              >
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                Accept
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => respond.mutate({ request_id: req.request_id, action: "reject" })}
                disabled={respond.isPending}
              >
                <XCircle className="mr-1 h-3.5 w-3.5" />
                Reject
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}