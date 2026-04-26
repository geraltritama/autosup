import { type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type KpiTone = "success" | "warning" | "info" | "danger";

const iconToneClasses: Record<KpiTone, string> = {
  success: "bg-emerald-50 text-emerald-600",
  warning: "bg-amber-50 text-amber-600",
  info: "bg-blue-50 text-blue-600",
  danger: "bg-rose-50 text-rose-600",
};

export function KpiCard({
  label,
  value,
  meta,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  meta: string;
  tone: KpiTone;
  icon: LucideIcon;
}) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="space-y-2">
          <p className="text-sm text-[#64748B]">{label}</p>
          <p className="text-2xl font-semibold tracking-tight text-[#0F172A]">{value}</p>
          <Badge
            tone={
              tone === "success"
                ? "success"
                : tone === "warning"
                  ? "warning"
                  : tone === "danger"
                    ? "danger"
                    : "info"
            }
          >
            {meta}
          </Badge>
        </div>
        <div className={`rounded-xl p-3 ${iconToneClasses[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}
