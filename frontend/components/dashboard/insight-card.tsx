import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AiInsight } from "@/hooks/useDashboard";

const urgencyTone = {
  high: "danger",
  medium: "warning",
  low: "info",
} as const;

const urgencyLabel = {
  high: "Prioritas tinggi",
  medium: "Perhatikan",
  low: "Info",
} as const;

export function InsightCard({ insights }: { insights: AiInsight[] }) {
  const primary = insights[0];
  const secondary = insights.slice(1);

  if (!primary) return null;

  return (
    <Card className="rounded-2xl border-blue-100 bg-[linear-gradient(135deg,#EFF6FF_0%,#FFFFFF_65%)]">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge tone="info">AI operations insight</Badge>
            <Badge tone={urgencyTone[primary.urgency]}>{urgencyLabel[primary.urgency]}</Badge>
          </div>
          <CardTitle className="text-xl">{primary.message}</CardTitle>
        </div>
        <div className="rounded-xl bg-white/80 p-3 text-[#2563EB] shadow-sm">
          <Sparkles className="h-5 w-5" />
        </div>
      </CardHeader>

      {secondary.length > 0 && (
        <CardContent className="space-y-2">
          {secondary.map((insight) => (
            <div
              key={insight.item_id + insight.type}
              className="flex items-start gap-3 rounded-xl border border-white/80 bg-white/70 p-3"
            >
              <Badge tone={urgencyTone[insight.urgency]} className="mt-0.5 shrink-0">
                {urgencyLabel[insight.urgency]}
              </Badge>
              <p className="text-sm leading-6 text-[#475569]">{insight.message}</p>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}
