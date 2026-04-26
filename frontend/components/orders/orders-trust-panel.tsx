import { CheckCircle2, ShieldCheck, WalletCards } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function OrdersTrustPanel() {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="space-y-3">
        <Badge tone="info" className="w-fit">
          Backend outcome
        </Badge>
        <CardTitle className="text-lg">Escrow and reputation outcome</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-[#E2E8F0] p-4">
          <WalletCards className="mt-0.5 h-5 w-5 text-[#3B82F6]" />
          <div>
            <p className="text-sm font-medium text-[#0F172A]">
              Escrow is backend-managed
            </p>
            <p className="mt-1 text-sm leading-6 text-[#64748B]">
              Saat order mencapai status `delivered`, pelepasan escrow ditampilkan sebagai hasil sistem, bukan aksi manual dari browser.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-[#E2E8F0] p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-[#22C55E]" />
          <div>
            <p className="text-sm font-medium text-[#0F172A]">
              Supplier reputation updates happen downstream
            </p>
            <p className="mt-1 text-sm leading-6 text-[#64748B]">
              Update reputasi supplier adalah outcome backend/on-chain yang hanya disurface di UI saat status order selesai.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-[#E2E8F0] p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-[#F59E0B]" />
          <div>
            <p className="text-sm font-medium text-[#0F172A]">
              No browser-side blockchain action
            </p>
            <p className="mt-1 text-sm leading-6 text-[#64748B]">
              Orders page cukup menjelaskan trust outcome secara operasional tanpa wallet-native flow.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
