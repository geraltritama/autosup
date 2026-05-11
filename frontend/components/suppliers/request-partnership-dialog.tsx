"use client";

import { useState, useRef } from "react";
import { Building2, FileText, Hash, Loader2, MapPin, Upload } from "lucide-react";
import { LegacyDialog as Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRequestPartnership, type Supplier } from "@/hooks/useSuppliers";

type Props = {
  open: boolean;
  onClose: () => void;
  supplier: Supplier | null;
  onSuccess?: (supplierId: string) => void;
};

export function RequestPartnershipDialog({ open, onClose, supplier, onSuccess }: Props) {
  const [step, setStep] = useState<"form" | "success">("form");
  const [error, setError] = useState<string | null>(null);

  const [terms, setTerms] = useState("");
  const [distributionRegion, setDistributionRegion] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [hash, setHash] = useState("");
  const [documentDataUrl, setDocumentDataUrl] = useState("");
  const [hashing, setHashing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const request = useRequestPartnership();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("Only PDF allowed.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("PDF max 2MB.");
      return;
    }
    setSelectedFile(file);
    setHashing(true);
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
      setHash(hex);
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
        reader.onerror = () => reject(new Error("file_read_failed"));
        reader.readAsDataURL(file);
      });
      setDocumentDataUrl(dataUrl);
    } catch {
      setError("Failed to generate hash from PDF.");
    }
    setHashing(false);
  }

  async function handleConfirm() {
    if (!supplier) return;
    setError(null);
    try {
      await request.mutateAsync({
        supplier_id: supplier.supplier_id,
        terms: terms || undefined,
        legal_contract_hash: hash || undefined,
        valid_until: validUntil ? Math.floor(new Date(validUntil).getTime() / 1000) : undefined,
        distribution_region: distributionRegion || undefined,
        mou_document_name: selectedFile?.name || undefined,
        mou_document_data: documentDataUrl || undefined,
      });
      setStep("success");
      onSuccess?.(supplier.supplier_id);
    } catch {
      setError("Failed to send request. Try again.");
    }
  }

  function handleClose() {
    setStep("form");
    setError(null);
    setTerms("");
    setDistributionRegion("");
    setValidUntil("");
    setSelectedFile(null);
    setHash("");
    setDocumentDataUrl("");
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={step === "success" ? "Request Sent" : "Request Partnership"}
      description={
        step === "success"
          ? `Partnership request sent to ${supplier?.name}. MOU hash stored on-chain. Waiting for their response.`
          : `Send a partnership request to ${supplier?.name} with MOU details.`
      }
    >
      {step === "form" && supplier && (
        <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
          <div className="rounded-xl border border-[#E2E8F0] bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB]">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#0F172A]">{supplier.name}</p>
                <p className="text-xs text-[#64748B]">
                  {supplier.category} · Reputation {supplier.reputation_score}
                </p>
              </div>
            </div>
          </div>

          {/* MOU Terms */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-[#64748B]">
              MOU Terms (max 256 chars)
            </label>
            <Input
              placeholder="e.g. Exclusive distribution agreement for Jakarta region"
              value={terms}
              onChange={(e) => setTerms(e.target.value.slice(0, 256))}
            />
            <p className="text-right text-[11px] text-[#94A3B8]">{terms.length}/256</p>
          </div>

          {/* Distribution Region */}
          <div className="space-y-1">
            <label className="flex items-center gap-1 text-xs font-medium text-[#64748B]">
              <MapPin className="h-3 w-3" /> Distribution Region (max 64 chars)
            </label>
            <Input
              placeholder="e.g. Jakarta, Bandung"
              value={distributionRegion}
              onChange={(e) => setDistributionRegion(e.target.value.slice(0, 64))}
            />
          </div>

          {/* Valid Until */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-[#64748B]">Valid Until (optional)</label>
            <Input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </div>

          {/* MOU PDF Upload */}
          <div className="space-y-2 rounded-xl border border-dashed border-[#CBD5E1] p-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#64748B]" />
              <p className="text-xs font-medium text-[#64748B]">MOU Document (PDF) <span className="text-[#94A3B8] italic">— optional</span></p>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="hidden"
            />

            {!selectedFile ? (
              <Button
                type="button"
                variant="secondary"
                className="w-full gap-2"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                Upload MOU PDF
              </Button>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
                  <span className="truncate text-[#0F172A]">{selectedFile.name}</span>
                  <button
                    type="button"
                    onClick={() => { setSelectedFile(null); setHash(""); setDocumentDataUrl(""); }}
                    className="ml-2 text-xs text-[#EF4444] hover:underline shrink-0"
                  >
                    Remove
                  </button>
                </div>
                {hashing ? (
                  <div className="flex items-center gap-2 text-xs text-[#64748B]">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Generating hash...
                  </div>
                ) : hash ? (
                  <div className="flex items-start gap-2 rounded-lg bg-[#F0FDF4] px-3 py-2 text-xs">
                    <Hash className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#16A34A]" />
                    <div className="min-w-0">
                      <p className="font-medium text-[#16A34A]">SHA-256 Hash</p>
                      <p className="font-mono text-[#64748B] break-all">{hash}</p>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-[#DC2626]">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={handleClose} disabled={request.isPending}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={request.isPending} className="gap-2">
              {request.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {request.isPending ? "Sending..." : "Send Request"}
            </Button>
          </div>
        </div>
      )}

      {step === "success" && (
        <div className="flex justify-end">
          <Button onClick={handleClose}>Close</Button>
        </div>
      )}
    </Dialog>
  );
}
