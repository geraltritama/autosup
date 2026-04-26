import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function InsightCard() {
  return (
    <Card className="rounded-2xl border-blue-100 bg-[linear-gradient(135deg,#EFF6FF_0%,#FFFFFF_65%)]">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-2">
          <Badge tone="info" className="w-fit">
            AI operations insight
          </Badge>
          <CardTitle className="text-xl">
            Demand for Premium Flour increased by 25% this week
          </CardTitle>
        </div>
        <div className="rounded-xl bg-white/80 p-3 text-[#2563EB] shadow-sm">
          <Sparkles className="h-5 w-5" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-6 text-[#475569]">
          AI mendeteksi lonjakan permintaan dari distributor wilayah Jakarta dan Surabaya. Produksi tambahan dan slot pemrosesan order untuk tepung dan gula sebaiknya diprioritaskan hari ini.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-white/80 bg-white/70 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#64748B]">
              Signal
            </p>
            <p className="mt-2 text-sm font-medium text-[#0F172A]">
              High demand detected in Jakarta and Surabaya
            </p>
          </div>
          <div className="rounded-xl border border-white/80 bg-white/70 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#64748B]">
              Recommended action
            </p>
            <p className="mt-2 text-sm font-medium text-[#0F172A]">
              Increase production allocation for Sugar and Premium Flour
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
