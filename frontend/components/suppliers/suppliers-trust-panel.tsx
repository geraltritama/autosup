import { CheckCircle2, Clock3, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function SuppliersTrustPanel() {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="space-y-3">
        <Badge tone="info" className="w-fit">
          Trust and partnership
        </Badge>
        <CardTitle className="text-lg">Partnership trust layer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-[#E2E8F0] p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-[#3B82F6]" />
          <div>
            <p className="text-sm font-medium text-[#0F172A]">
              Backend-driven verification
            </p>
            <p className="mt-1 text-sm leading-6 text-[#64748B]">
              Partnership NFT dan blockchain trust ditampilkan sebagai hasil sistem, bukan flow wallet langsung dari browser.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-[#E2E8F0] p-4">
          <Clock3 className="mt-0.5 h-5 w-5 text-[#F59E0B]" />
          <div>
            <p className="text-sm font-medium text-[#0F172A]">Pending requests</p>
            <p className="mt-1 text-sm leading-6 text-[#64748B]">
              Request partnership tetap bisa dipersiapkan sekarang dengan mock state sebelum connect ke API nyata.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-[#E2E8F0] p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-[#22C55E]" />
          <div>
            <p className="text-sm font-medium text-[#0F172A]">Operational trust signal</p>
            <p className="mt-1 text-sm leading-6 text-[#64748B]">
              Reputation score, delivery rate, dan transaction history tetap jadi sinyal utama untuk menilai supplier di UI.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
