"use client";

import { Calendar, Download, FileText, Hash, Loader2, MapPin, Phone, Mail, User, PackageOpen, Percent, Star, TrendingUp, Truck } from "lucide-react";
import { LegacyDialog as Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDistributorPartnershipHistory, type Distributor } from "@/hooks/useDistributors";

type Props = {
  open: boolean;
  onClose: () => void;
  distributor: Distributor | null;
  role?: "retailer" | "supplier";
};

const statusLabel: Record<Distributor["partnership_status"], string> = {
  partner: "Partner",
  pending: "Pending",
  none: "Not Partnered",
};

const statusTone: Record<Distributor["partnership_status"], "success" | "warning" | "neutral"> = {
  partner: "success",
  pending: "warning",
  none: "neutral",
};

const historyTone = {
  approved: "success",
  accepted: "success",
  pending: "warning",
  rejected: "danger",
  terminated: "neutral",
} as const;

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

function formatValidUntil(ts?: string | number | null) {
  if (!ts || ts === 0) return null;
  try {
    const parsed = typeof ts === "number" ? new Date(ts * 1000) : new Date(ts);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
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

export function DistributorDetailDialog({ open, onClose, distributor, role = "supplier" }: Props) {
  const { data: historyData, isLoading: isHistoryLoading } = useDistributorPartnershipHistory(
    open ? (distributor?.distributor_id ?? null) : null,
  );
  if (!distributor) return null;
  const history = historyData?.history ?? [];
  const latestRecord = history[0];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Distributor Detail"
      description={`Complete information about ${distributor.name}`}
    >
      <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-2">
        {/* Header - Name & Status */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[#0F172A]">{distributor.name}</h3>
            <p className="text-sm text-[#64748B]">{distributor.business_name}</p>
          </div>
          <Badge tone={statusTone[distributor.partnership_status]}>
            {statusLabel[distributor.partnership_status]}
          </Badge>
        </div>

        {/* Company Info */}
        {distributor.address && (
          <div className="rounded-xl border border-[#E2E8F0] p-4 space-y-2">
            <p className="text-xs uppercase tracking-[0.15em] text-[#64748B]">Address</p>
            <div className="flex items-start gap-2 text-sm text-[#0F172A]">
              <MapPin className="h-4 w-4 shrink-0 text-[#64748B]" />
              <span>{distributor.address}</span>
            </div>
          </div>
        )}

        {/* Contact Info */}
        {(distributor.contact_person || distributor.phone || distributor.email) && (
          <div className="rounded-xl border border-[#E2E8F0] p-4 space-y-3">
            <p className="text-xs uppercase tracking-[0.15em] text-[#64748B]">Contact</p>
            {distributor.contact_person && (
              <div className="flex items-center gap-2 text-sm text-[#0F172A]">
                <User className="h-4 w-4 shrink-0 text-[#64748B]" />
                <span>{distributor.contact_person}</span>
              </div>
            )}
            {distributor.phone && (
              <div className="flex items-center gap-2 text-sm text-[#0F172A]">
                <Phone className="h-4 w-4 shrink-0 text-[#64748B]" />
                <span>{distributor.phone}</span>
              </div>
            )}
            {distributor.email && (
              <div className="flex items-center gap-2 text-sm text-[#0F172A]">
                <Mail className="h-4 w-4 shrink-0 text-[#64748B]" />
                <span>{distributor.email}</span>
              </div>
            )}
          </div>
        )}

        {/* Region & Join Date */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-[#64748B]">Region</p>
            <p className="text-sm font-medium text-[#0F172A]">{distributor.region}</p>
          </div>
          {distributor.joined_at && (
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-[#64748B]">Became Partner</p>
              <p className="text-sm font-medium text-[#0F172A]">
                {new Date(distributor.joined_at).toLocaleDateString("en-US", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
          )}
        </div>

        {distributor.partnership_status !== "none" && (
          <div className="rounded-xl border border-[#E2E8F0] p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-[#64748B]">Partnership Data</p>
                <p className="text-sm text-[#0F172A]">
                  {role === "retailer" ? "Latest retailer agreement, MOU, and NFT data." : "Latest MOU and distributor request history."}
                </p>
              </div>
              {latestRecord && (
                <Badge tone={historyTone[latestRecord.status] ?? "neutral"}>
                  {latestRecord.status}
                </Badge>
              )}
            </div>

            {isHistoryLoading && (
              <div className="flex items-center gap-2 text-sm text-[#64748B]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading partnership data...
              </div>
            )}

            {!isHistoryLoading && latestRecord && (
              <div className="space-y-3 rounded-xl bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-[#0F172A]">
                  <FileText className="h-4 w-4 text-[#64748B]" />
                  Latest MOU
                </div>

                {latestRecord.terms && (
                  <div>
                    <p className="text-xs text-[#64748B]">Terms</p>
                    <p className="mt-1 text-sm leading-relaxed text-[#0F172A]">{latestRecord.terms}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {latestRecord.distribution_region && (
                    <div className="rounded-lg bg-white p-3">
                      <p className="text-xs text-[#64748B]">Region</p>
                      <p className="text-sm font-medium text-[#0F172A]">{latestRecord.distribution_region}</p>
                    </div>
                  )}
                  {formatValidUntil(latestRecord.valid_until) && (
                    <div className="rounded-lg bg-white p-3">
                      <p className="text-xs text-[#64748B]">Valid Until</p>
                      <p className="text-sm font-medium text-[#0F172A]">{formatValidUntil(latestRecord.valid_until)}</p>
                    </div>
                  )}
                </div>

                {latestRecord.legal_contract_hash && (
                  <div className="rounded-lg border border-[#DDD6FE] bg-[#F5F3FF] px-3 py-2">
                    <div className="flex items-center gap-2 text-xs text-[#64748B]">
                      <Hash className="h-3.5 w-3.5" />
                      MOU Hash (On-Chain)
                    </div>
                    <p className="mt-1 font-mono text-xs text-[#7C3AED] break-all">{latestRecord.legal_contract_hash}</p>
                  </div>
                )}

                {/* Partnership NFT */}
                {latestRecord.nft_mint_address && (
                  <div className="rounded-lg border border-[#DBEAFE] bg-[#EFF6FF] px-3 py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#2563EB] text-white">
                          <Star className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-[#1E40AF]">{latestRecord.nft_token_name || "Partnership NFT"}</p>
                          <p className="text-[10px] text-[#64748B]">Minted {latestRecord.created_at ? new Date(latestRecord.created_at).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : ""}</p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-md bg-white px-2.5 py-2 space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-[#64748B]">Mint Address</span>
                        <span className="font-mono text-[#0F172A]">{latestRecord.nft_mint_address.slice(0, 16)}...</span>
                      </div>
                      {latestRecord.legal_contract_hash && (
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-[#64748B]">MOU Hash</span>
                          <span className="font-mono text-[#7C3AED]">{latestRecord.legal_contract_hash.slice(0, 16)}...</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-[#64748B]">Network</span>
                        <span className="text-[#0F172A]">Solana Devnet</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[10px] text-emerald-600">
                        <span>✅ Verified</span>
                        <span>✅ Soulbound</span>
                      </div>
                      {latestRecord.nft_explorer_url && (
                        <a href={latestRecord.nft_explorer_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#2563EB] hover:underline">
                          View on-chain →
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {latestRecord.mou_document_data && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        className="gap-2"
                        onClick={() => window.open(latestRecord.mou_document_data, "_blank", "noopener,noreferrer")}
                      >
                        <FileText className="h-4 w-4" />
                        View MOU
                      </Button>
                      <Button
                        variant="secondary"
                        className="gap-2"
                        onClick={() => downloadMou(latestRecord.mou_document_data ?? "", latestRecord.mou_document_name || "mou-document.pdf")}
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </Button>
                    </div>
                    <p className="text-xs text-[#64748B]">
                      {latestRecord.mou_document_name || "mou-document.pdf"}
                    </p>
                  </div>
                )}
              </div>
            )}

            {!isHistoryLoading && history.length > 1 && (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.15em] text-[#64748B]">History</p>
                <div className="space-y-2">
                  {history.slice(1).map((item) => (
                    <div key={item.request_id} className="flex items-center justify-between gap-3 rounded-lg border border-[#E2E8F0] px-3 py-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm text-[#0F172A]">
                          <Calendar className="h-4 w-4 text-[#64748B]" />
                          {formatDate(item.created_at)}
                        </div>
                        <p className="mt-1 truncate text-xs text-[#64748B]">
                          {item.mou_document_name || item.terms || "No MOU content"}
                        </p>
                      </div>
                      <Badge tone={historyTone[item.status] ?? "neutral"}>{item.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!isHistoryLoading && history.length === 0 && (
              <p className="text-sm text-[#64748B]">No partnership data yet.</p>
            )}
          </div>
        )}

        {/* Business Metrics */}
        <div className="rounded-xl border border-[#E2E8F0] p-4">
          <p className="text-xs uppercase tracking-[0.15em] text-[#64748B] mb-3">Business Metrics</p>
          <div className="grid grid-cols-2 gap-3">
            {role === "retailer" ? (
              <>
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <Truck className="h-4 w-4 mx-auto text-[#64748B] mb-1" />
                  <p className="text-lg font-semibold text-[#0F172A]">{distributor.avg_delivery_days} days</p>
                  <p className="text-xs text-[#64748B]">Avg. Delivery</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <Star className="h-4 w-4 mx-auto text-[#64748B] mb-1" />
                  <p className="text-lg font-semibold text-[#0F172A]">{distributor.reputation_score}</p>
                  <p className="text-xs text-[#64748B]">Reputation</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <Percent className="h-4 w-4 mx-auto text-[#64748B] mb-1" />
                  <p className="text-lg font-semibold text-[#22C55E]">{distributor.on_time_delivery_rate}%</p>
                  <p className="text-xs text-[#64748B]">On-time Delivery</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <PackageOpen className="h-4 w-4 mx-auto text-[#64748B] mb-1" />
                  <p className="text-lg font-semibold text-[#0F172A]">{distributor.order_volume}</p>
                  <p className="text-xs text-[#64748B]">My Orders</p>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <PackageOpen className="h-4 w-4 mx-auto text-[#64748B] mb-1" />
                  <p className="text-lg font-semibold text-[#0F172A]">{distributor.order_volume}</p>
                  <p className="text-xs text-[#64748B]">Order Volume</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <Percent className="h-4 w-4 mx-auto text-[#64748B] mb-1" />
                  <p className="text-lg font-semibold text-[#0F172A]">{distributor.payment_punctuality}%</p>
                  <p className="text-xs text-[#64748B]">On-time Payment</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <Star className="h-4 w-4 mx-auto text-[#64748B] mb-1" />
                  <p className="text-lg font-semibold text-[#0F172A]">{distributor.reputation_score}</p>
                  <p className="text-xs text-[#64748B]">Reputation</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <TrendingUp className="h-4 w-4 mx-auto text-[#64748B] mb-1" />
                  <p className="text-lg font-semibold text-[#0F172A]">{distributor.total_transactions}</p>
                  <p className="text-xs text-[#64748B]">Total Transactions</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
