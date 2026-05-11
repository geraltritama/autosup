"use client";

import { Building2, Calendar, MapPin, Phone, Mail, User, Star, FileText, Shield } from "lucide-react";
import { LegacyDialog as Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DistributorPartnershipRequest } from "@/hooks/useDistributors";

type Props = {
  open: boolean;
  onClose: () => void;
  request: DistributorPartnershipRequest | null;
  onAccept: (request_id: string) => void;
  onReject: (request_id: string) => void;
  isProcessing: boolean;
};

export function PartnershipRequestDetailDialog({
  open,
  onClose,
  request,
  onAccept,
  onReject,
  isProcessing,
}: Props) {
  if (!request) return null;

  const formatDate = (dateStr: string) => {
    return new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(dateStr));
  };

  const handleAccept = () => {
    onAccept(request.request_id);
  };

  const handleReject = () => {
    onReject(request.request_id);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Partnership Request Detail"
      description="Review details before accepting or rejecting the partnership request."
    >
      <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-2">
        {/* Distributor Info Card */}
        <div className="rounded-xl border border-[#E2E8F0] p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB]">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-base font-semibold text-[#0F172A]">
                {request.distributor.business_name}
              </p>
              <p className="text-sm text-[#64748B]">{request.distributor.name}</p>
            </div>
            <Badge tone="warning" className="ml-auto">
              Pending
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            {request.distributor.region && (
              <div className="flex items-center gap-2 text-[#64748B]">
                <MapPin className="h-4 w-4" />
                <span>{request.distributor.region}</span>
              </div>
            )}
            {request.distributor.reputation_score && (
              <div className="flex items-center gap-2 text-[#64748B]">
                <Star className="h-4 w-4" />
                <span>Reputation: {request.distributor.reputation_score}</span>
              </div>
            )}
            {request.distributor.contact_person && (
              <div className="flex items-center gap-2 text-[#64748B]">
                <User className="h-4 w-4" />
                <span>{request.distributor.contact_person}</span>
              </div>
            )}
            {request.distributor.phone && (
              <div className="flex items-center gap-2 text-[#64748B]">
                <Phone className="h-4 w-4" />
                <span>{request.distributor.phone}</span>
              </div>
            )}
            {request.distributor.email && (
              <div className="flex items-center gap-2 text-[#64748B]">
                <Mail className="h-4 w-4" />
                <span>{request.distributor.email}</span>
              </div>
            )}
          </div>
        </div>

        {/* Request Date */}
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4">
          <Calendar className="h-5 w-5 text-[#64748B]" />
          <div>
            <p className="text-xs text-[#64748B]">Application Date</p>
            <p className="text-sm font-medium text-[#0F172A]">
              {formatDate(request.created_at)}
            </p>
          </div>
        </div>

        {/* Contract Details */}
        {(request.mou_terms || request.terms || request.mou_region) && (
          <div className="rounded-xl border border-[#E2E8F0] p-4 space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#64748B]" />
              <p className="text-xs uppercase tracking-[0.15em] text-[#64748B]">
                MOU Document
              </p>
            </div>

            {request.mou_region && (
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-[#64748B] mb-1">Distribution Region</p>
                <p className="text-sm font-medium text-[#0F172A]">{request.mou_region}</p>
              </div>
            )}

            {(request.mou_terms || request.terms) && (
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-[#64748B] mb-1">Terms & Conditions</p>
                <p className="text-sm text-[#0F172A] leading-relaxed">{request.mou_terms || request.terms}</p>
              </div>
            )}
          </div>
        )}

        {/* NFT Trust Layer Info */}
        <div className="rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-4 w-4 text-[#2563EB]" />
            <p className="text-sm font-semibold text-[#1E40AF]">Partnership Trust Layer</p>
          </div>
          <p className="text-sm text-[#3B82F6]">
            A Partnership NFT will be issued by the system after you accept this request.
            The partnership will be protected with an on-chain trust layer.
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-[#E2E8F0]">
        <Button
          variant="secondary"
          onClick={handleReject}
          disabled={isProcessing}
        >
          Reject
        </Button>
        <Button
          onClick={handleAccept}
          disabled={isProcessing}
        >
          {isProcessing ? "Memproses..." : "Accept Partnership"}
        </Button>
      </div>
    </Dialog>
  );
}