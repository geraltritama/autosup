"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AiInsight } from "@/hooks/useDashboard";

const urgencyTone = {
  high: "danger",
  medium: "warning",
  low: "info",
} as const;

const urgencyLabel = {
  high: "High priority",
  medium: "Attention",
  low: "Info",
} as const;

function tryParseJson(text: string): Record<string, unknown> | null {
  try { return JSON.parse(text); } catch { return null; }
}

function InsightDetail({ fullResult }: { fullResult: string }) {
  const parsed = tryParseJson(fullResult);
  if (!parsed) {
    return <p className="text-xs text-[#475569] whitespace-pre-wrap">{fullResult.slice(0, 400)}</p>;
  }

  const analysis = parsed.analysis as Record<string, unknown> | undefined;
  const action = parsed.recommended_action as Record<string, unknown> | undefined;
  const invStatus = parsed.inventory_status as Record<string, unknown> | undefined;
  const credit = parsed.credit_analysis as Record<string, unknown> | undefined;
  const demand = parsed.demand_analysis as Record<string, unknown> | undefined;
  const sales = parsed.sales_analysis as Record<string, unknown> | undefined;
  const cashflow = parsed.cashflow_analysis as Record<string, unknown> | undefined;
  const shipment = parsed.shipment_analysis as Record<string, unknown> | undefined;
  const pricing = parsed.pricing_analysis as Record<string, unknown> | undefined;
  const partnership = parsed.partnership_analysis as Record<string, unknown> | undefined;
  const demandFc = parsed.demand_forecast as Record<string, unknown> | undefined;
  const confidence = (analysis?.confidence_score as number) || 0;
  const issue = (analysis?.issue_detected as string) || "NONE";
  const actionType = (action?.action_type as string) || "NONE";
  const urgency = (parsed.urgency_level as string) || "MEDIUM";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Badge tone={urgency === "HIGH" ? "danger" : urgency === "MEDIUM" ? "warning" : "info"} className="text-[10px] px-1.5 py-0">{urgency}</Badge>
        <Badge tone={issue === "NONE" ? "success" : "warning"} className="text-[10px] px-1.5 py-0">{actionType.replace(/_/g, " ")}</Badge>
        <span className="text-[10px] text-[#64748B]">confidence {Math.round(confidence * 100)}%</span>
      </div>

      {invStatus && Object.keys(invStatus).length > 0 && (
        <div className="rounded bg-white/80 p-2 text-[11px] space-y-0.5">
          <p className="font-medium text-[#0F172A]">Inventory</p>
          {Object.entries(invStatus).slice(0, 4).map(([k, v]) => (
            <p key={k} className="text-[#64748B] capitalize">{k.replace(/_/g, " ")}: <span className="text-[#0F172A] font-medium">{String(v)}</span></p>
          ))}
        </div>
      )}

      {credit && Object.keys(credit).length > 0 && (
        <div className="rounded bg-white/80 p-2 text-[11px] space-y-0.5">
          <p className="font-medium text-[#0F172A]">Credit</p>
          {Object.entries(credit).slice(0, 4).map(([k, v]) => (
            <p key={k} className="text-[#64748B] capitalize">{k.replace(/_/g, " ")}: <span className="text-[#0F172A] font-medium">{String(v)}</span></p>
          ))}
        </div>
      )}

      {cashflow && Object.keys(cashflow).length > 0 && (
        <div className="rounded bg-white/80 p-2 text-[11px] space-y-0.5">
          <p className="font-medium text-[#0F172A]">Cashflow</p>
          {Object.entries(cashflow).slice(0, 4).map(([k, v]) => (
            <p key={k} className="text-[#64748B] capitalize">{k.replace(/_/g, " ")}: <span className="text-[#0F172A] font-medium">{String(v)}</span></p>
          ))}
        </div>
      )}

      {shipment && Object.keys(shipment).length > 0 && (
        <div className="rounded bg-white/80 p-2 text-[11px] space-y-0.5">
          <p className="font-medium text-[#0F172A]">Shipments</p>
          {Object.entries(shipment).slice(0, 4).map(([k, v]) => (
            <p key={k} className="text-[#64748B] capitalize">{k.replace(/_/g, " ")}: <span className="text-[#0F172A] font-medium">{String(v)}</span></p>
          ))}
        </div>
      )}

      {pricing && Object.keys(pricing).length > 0 && (
        <div className="rounded bg-white/80 p-2 text-[11px] space-y-0.5">
          <p className="font-medium text-[#0F172A]">Pricing</p>
          {Object.entries(pricing).filter(([, v]) => !Array.isArray(v)).slice(0, 4).map(([k, v]) => (
            <p key={k} className="text-[#64748B] capitalize">{k.replace(/_/g, " ")}: <span className="text-[#0F172A] font-medium">{String(v)}</span></p>
          ))}
        </div>
      )}

      {demand && Object.keys(demand).length > 0 && (
        <div className="rounded bg-white/80 p-2 text-[11px] space-y-0.5">
          <p className="font-medium text-[#0F172A]">Demand</p>
          {Object.entries(demand).filter(([, v]) => !Array.isArray(v)).slice(0, 4).map(([k, v]) => (
            <p key={k} className="text-[#64748B] capitalize">{k.replace(/_/g, " ")}: <span className="text-[#0F172A] font-medium">{String(v)}</span></p>
          ))}
        </div>
      )}

      {sales && Object.keys(sales).length > 0 && (
        <div className="rounded bg-white/80 p-2 text-[11px] space-y-0.5">
          <p className="font-medium text-[#0F172A]">Sales</p>
          {Object.entries(sales).filter(([, v]) => !Array.isArray(v)).slice(0, 4).map(([k, v]) => (
            <p key={k} className="text-[#64748B] capitalize">{k.replace(/_/g, " ")}: <span className="text-[#0F172A] font-medium">{String(v)}</span></p>
          ))}
        </div>
      )}

      {partnership && Object.keys(partnership).length > 0 && (
        <div className="rounded bg-white/80 p-2 text-[11px] space-y-0.5">
          <p className="font-medium text-[#0F172A]">Partnership</p>
          {Object.entries(partnership).filter(([, v]) => !Array.isArray(v)).slice(0, 4).map(([k, v]) => (
            <p key={k} className="text-[#64748B] capitalize">{k.replace(/_/g, " ")}: <span className="text-[#0F172A] font-medium">{String(v)}</span></p>
          ))}
        </div>
      )}

      {demandFc && Object.keys(demandFc).length > 0 && (
        <div className="rounded bg-white/80 p-2 text-[11px] space-y-0.5">
          <p className="font-medium text-[#0F172A]">Forecast</p>
          {Object.entries(demandFc).filter(([, v]) => !Array.isArray(v)).slice(0, 4).map(([k, v]) => (
            <p key={k} className="text-[#64748B] capitalize">{k.replace(/_/g, " ")}: <span className="text-[#0F172A] font-medium">{String(v)}</span></p>
          ))}
        </div>
      )}

      {analysis && issue !== "NONE" && (
        <div className="rounded bg-white/80 p-2 text-[11px]">
          <p className="font-medium text-[#0F172A]">Finding</p>
          <p className="text-[#64748B]">{analysis.reason as string || issue.replace(/_/g, " ")}</p>
        </div>
      )}
    </div>
  );
}

export function InsightCard({
  insights,
  badgeLabel = "AI operations insight",
}: {
  insights: AiInsight[];
  badgeLabel?: string;
}) {
  const primary = insights[0];
  const secondary = insights.slice(1);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  if (!primary) return null;

  const primaryHasDetail = !!(primary.full_result && primary.full_result.length > 10);
  const primaryExpanded = expandedIdx === -1;

  return (
    <Card className="rounded-2xl border-blue-100 bg-[linear-gradient(135deg,#EFF6FF_0%,#FFFFFF_65%)]">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <button type="button" onClick={() => setExpandedIdx(primaryExpanded ? null : -1)} className="text-left space-y-2 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Badge tone="info">{badgeLabel}</Badge>
            <Badge tone={urgencyTone[primary.urgency]}>{urgencyLabel[primary.urgency]}</Badge>
          </div>
          <p className={`text-lg font-semibold text-[#0F172A] ${primaryExpanded ? "" : "line-clamp-2"}`}>{primary.message}</p>
          {primary.agent_name && <p className="text-xs text-[#94A3B8]">{primary.agent_name}</p>}
          {primaryHasDetail && (
            <p className="text-[10px] text-[#3B82F6] font-medium flex items-center gap-1">
              {primaryExpanded ? <><ChevronUp className="h-3 w-3" /> Close details</> : <><ChevronDown className="h-3 w-3" /> View full insight</>}
            </p>
          )}
        </button>
        <div className="rounded-xl bg-white/80 p-3 text-[#2563EB] shadow-sm shrink-0">
          <Sparkles className="h-5 w-5" />
        </div>
      </CardHeader>

      {primaryExpanded && primaryHasDetail && (
        <CardContent className="pt-0 pb-4">
          <div className="rounded-xl border border-[#E2E8F0] bg-white/80 p-4">
            <InsightDetail fullResult={primary.full_result!} />
          </div>
        </CardContent>
      )}

      {secondary.length > 0 && (
        <CardContent className="space-y-2">
          {secondary.map((insight, i) => {
            const isExpanded = expandedIdx === i;
            const hasDetail = !!(insight.full_result && insight.full_result.length > 10);

            return (
              <div key={insight.timestamp || `insight-${i}`}>
                <button
                  type="button"
                  onClick={() => setExpandedIdx(isExpanded ? null : i)}
                  className="w-full text-left flex items-start gap-3 rounded-xl border border-white/80 bg-white/70 p-3 hover:border-[#3B82F6]/30 transition-colors"
                >
                  <Badge tone={urgencyTone[insight.urgency]} className="mt-0.5 shrink-0">
                    {urgencyLabel[insight.urgency]}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-6 text-[#475569]">{insight.message}</p>
                    {insight.agent_name && (
                      <p className="text-[10px] text-[#94A3B8] mt-1">{insight.agent_name}</p>
                    )}
                    {/* Expanded detail */}
                    {isExpanded && hasDetail && (
                      <div className="mt-3 pt-3 border-t border-[#E2E8F0]">
                        <InsightDetail fullResult={insight.full_result!} />
                      </div>
                    )}
                    {/* Expand hint */}
                    {hasDetail && (
                      <p className="text-[10px] text-[#3B82F6] font-medium mt-1.5 flex items-center gap-1">
                        {isExpanded ? (
                          <><ChevronUp className="h-3 w-3" /> Close details</>
                        ) : (
                          <><ChevronDown className="h-3 w-3" /> View details</>
                        )}
                      </p>
                    )}
                  </div>
                </button>
              </div>
            );
          })}
        </CardContent>
      )}
    </Card>
  );
}
