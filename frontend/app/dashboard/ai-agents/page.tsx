"use client";

import { useEffect, useState } from "react";
import { 
  Bot, 
  BrainCircuit, 
  Clock, 
  Loader2, 
  Play,
  Sparkles, 
  TrendingUp, 
  Zap 
} from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { PageErrorState } from "@/components/dashboard/page-error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAiAgents, useUpdateAgentConfig, useRunAgent, useAutoTickAgents, useClearActivities, type AiAgentStatus } from "@/hooks/useAiAgents";
import { useAuthStore } from "@/store/useAuthStore";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

const statusTone = { active: "success", paused: "warning", disabled: "neutral" } as const;
const statusLabel = { active: "Active", paused: "Paused", disabled: "Disabled" } as const;

function tryParseJson(text: string | undefined): Record<string, unknown> | null {
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

/** Strip raw [TAG] prefixes from legacy AI output and humanize */
function cleanAiText(text: string): string {
  return text.replace(/^\[[\w|_]+\]\s*/, "").replace(/_/g, " ");
}

function ExpandedResult({ fullResult }: { fullResult: string }) {
  const parsed = tryParseJson(fullResult);
  if (!parsed) {
    return (
      <div className="mt-2 rounded-lg bg-slate-50 border border-[#E2E8F0] p-3">
        <p className="text-xs font-medium text-[#0F172A] mb-1">Raw Output</p>
        <p className="text-xs text-[#475569] whitespace-pre-wrap line-clamp-6">{fullResult.slice(0, 500)}</p>
      </div>
    );
  }

  const analysis = parsed.analysis as Record<string, unknown> | undefined;
  const action = parsed.recommended_action as Record<string, unknown> | undefined;
  const flags = parsed.system_flags as Record<string, unknown> | undefined;
  const invStatus = parsed.inventory_status as Record<string, unknown> | undefined;
  const credit = parsed.credit_analysis as Record<string, unknown> | undefined;
  const demand = parsed.demand_analysis as Record<string, unknown> | undefined;
  const sales = parsed.sales_analysis as Record<string, unknown> | undefined;
  const cashflow = parsed.cashflow_analysis as Record<string, unknown> | undefined;
  const shipment = parsed.shipment_analysis as Record<string, unknown> | undefined;
  const pricing = parsed.pricing_analysis as Record<string, unknown> | undefined;
  const partnership = parsed.partnership_analysis as Record<string, unknown> | undefined;
  const demandFc = parsed.demand_forecast as Record<string, unknown> | undefined;

  const issue = (analysis?.issue_detected as string) || "NONE";
  const confidence = (analysis?.confidence_score as number) || 0;
  const actionType = (action?.action_type as string) || "NONE";
  const urgency = (parsed.urgency_level as string) || "MEDIUM";
  const urgentTone = urgency === "HIGH" ? "danger" as const : urgency === "MEDIUM" ? "warning" as const : "info" as const;

  const confColor = confidence >= 0.8 ? "bg-green-100 text-green-700" : confidence >= 0.5 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";

  return (
    <div className="mt-2 rounded-lg bg-slate-50 border border-[#E2E8F0] p-3 space-y-2 text-xs">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="font-semibold text-[#0F172A]">{parsed.agent_type as string || "Agent"}</p>
        <div className="flex items-center gap-1.5">
          <Badge tone={urgentTone} className="text-[10px] px-1.5 py-0">{urgency}</Badge>
          <Badge tone={issue === "NONE" ? "success" : "warning"} className="text-[10px] px-1.5 py-0">{actionType.replace(/_/g, " ")}</Badge>
          <span className={`text-[10px] px-1 py-0 rounded font-medium ${confColor}`}>
            {Math.round(confidence * 100)}%
          </span>
        </div>
      </div>

      {/* Inventory Status */}
      {invStatus && Object.keys(invStatus).length > 0 && (
        <div className="rounded bg-white p-2 border border-[#E2E8F0]">
          <p className="font-medium text-[#0F172A] mb-1">Inventory</p>
          {Object.entries(invStatus).slice(0, 5).map(([k, v]) => (
            <p key={k} className="text-[#64748B] capitalize">
              {k.replace(/_/g, " ")}: <span className="text-[#0F172A] font-medium">{typeof v === "number" ? v.toLocaleString("en-US") : String(v)}</span>
            </p>
          ))}
        </div>
      )}

      {/* Credit Analysis */}
      {credit && Object.keys(credit).length > 0 && (
        <div className="rounded bg-white p-2 border border-[#E2E8F0]">
          <p className="font-medium text-[#0F172A] mb-1">Credit</p>
          {Object.entries(credit).slice(0, 5).map(([k, v]) => (
            <p key={k} className="text-[#64748B] capitalize">
              {k.replace(/_/g, " ")}: <span className="text-[#0F172A] font-medium">{typeof v === "number" ? v.toLocaleString("en-US") : String(v)}</span>
            </p>
          ))}
        </div>
      )}

      {/* Shipment Analysis */}
      {shipment && Object.keys(shipment).length > 0 && (
        <div className="rounded bg-white p-2 border border-[#E2E8F0]">
          <p className="font-medium text-[#0F172A] mb-1">Shipments</p>
          {Object.entries(shipment).slice(0, 4).map(([k, v]) => (
            <p key={k} className="text-[#64748B] capitalize">
              {k.replace(/_/g, " ")}: <span className="text-[#0F172A] font-medium">{typeof v === "number" ? v.toLocaleString("en-US") : String(v)}</span>
            </p>
          ))}
        </div>
      )}

      {/* Pricing */}
      {pricing && Object.keys(pricing).length > 0 && (
        <div className="rounded bg-white p-2 border border-[#E2E8F0]">
          <p className="font-medium text-[#0F172A] mb-1">Pricing</p>
          {Object.entries(pricing).filter(([, v]) => !Array.isArray(v)).slice(0, 4).map(([k, v]) => (
            <p key={k} className="text-[#64748B] capitalize">
              {k.replace(/_/g, " ")}: <span className="text-[#0F172A] font-medium">{typeof v === "number" ? v.toLocaleString("en-US") : String(v)}</span>
            </p>
          ))}
        </div>
      )}

      {/* Cashflow */}
      {cashflow && Object.keys(cashflow).length > 0 && (
        <div className="rounded bg-white p-2 border border-[#E2E8F0]">
          <p className="font-medium text-[#0F172A] mb-1">Cashflow</p>
          {Object.entries(cashflow).slice(0, 5).map(([k, v]) => (
            <p key={k} className="text-[#64748B] capitalize">
              {k.replace(/_/g, " ")}: <span className="text-[#0F172A] font-medium">{typeof v === "number" ? v.toLocaleString("en-US") : String(v)}</span>
            </p>
          ))}
        </div>
      )}

      {/* Demand Analysis */}
      {demand && Object.keys(demand).length > 0 && (
        <div className="rounded bg-white p-2 border border-[#E2E8F0]">
          <p className="font-medium text-[#0F172A] mb-1">Demand</p>
          {Object.entries(demand).filter(([, v]) => !Array.isArray(v)).slice(0, 4).map(([k, v]) => (
            <p key={k} className="text-[#64748B] capitalize">
              {k.replace(/_/g, " ")}: <span className="text-[#0F172A] font-medium">{typeof v === "number" ? v.toLocaleString("en-US") : String(v)}</span>
            </p>
          ))}
        </div>
      )}

      {/* Sales Analysis */}
      {sales && Object.keys(sales).length > 0 && (
        <div className="rounded bg-white p-2 border border-[#E2E8F0]">
          <p className="font-medium text-[#0F172A] mb-1">Sales</p>
          {Object.entries(sales).filter(([, v]) => !Array.isArray(v)).slice(0, 4).map(([k, v]) => (
            <p key={k} className="text-[#64748B] capitalize">
              {k.replace(/_/g, " ")}: <span className="text-[#0F172A] font-medium">{typeof v === "number" ? v.toLocaleString("en-US") : String(v)}</span>
            </p>
          ))}
        </div>
      )}

      {/* Partnership */}
      {partnership && Object.keys(partnership).length > 0 && (
        <div className="rounded bg-white p-2 border border-[#E2E8F0]">
          <p className="font-medium text-[#0F172A] mb-1">Partnership</p>
          {Object.entries(partnership).filter(([, v]) => !Array.isArray(v)).slice(0, 4).map(([k, v]) => (
            <p key={k} className="text-[#64748B] capitalize">
              {k.replace(/_/g, " ")}: <span className="text-[#0F172A] font-medium">{typeof v === "number" ? v.toLocaleString("en-US") : String(v)}</span>
            </p>
          ))}
        </div>
      )}

      {/* Demand Forecast */}
      {demandFc && Object.keys(demandFc).length > 0 && (
        <div className="rounded bg-white p-2 border border-[#E2E8F0]">
          <p className="font-medium text-[#0F172A] mb-1">Forecast</p>
          {Object.entries(demandFc).filter(([, v]) => !Array.isArray(v)).slice(0, 4).map(([k, v]) => (
            <p key={k} className="text-[#64748B] capitalize">
              {k.replace(/_/g, " ")}: <span className="text-[#0F172A] font-medium">{typeof v === "number" ? v.toLocaleString("en-US") : String(v)}</span>
            </p>
          ))}
        </div>
      )}

      {/* Analysis */}
      {analysis && issue !== "NONE" && (
        <div className="rounded bg-white p-2 border border-[#E2E8F0]">
          <p className="font-medium text-[#0F172A] mb-1">Findings</p>
          <p className="text-[#64748B]">{analysis.reason as string || issue.replace(/_/g, " ")}</p>
        </div>
      )}

      {/* System flags */}
      {flags && Object.keys(flags).length > 0 && (
        <div className="flex items-center gap-2 text-[10px] text-[#94A3B8]">
          <span>Human approval: {flags.requires_human_approval ? "Required" : "No"}</span>
          <span>&middot;</span>
          <span>Auto: {flags.auto_execute_allowed ? "Yes" : "No"}</span>
        </div>
      )}
    </div>
  );
}

export default function AiAgentsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const { data, isLoading, isError, refetch } = useAiAgents();
  const updateConfig = useUpdateAgentConfig();
  const runAgent = useRunAgent();
  const autoTick = useAutoTickAgents();
  const clearActivities = useClearActivities();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  // Auto-tick all active agents every 10 minutes (to avoid burning free-tier quota)
  useEffect(() => {
    const interval = setInterval(() => {
      autoTick.mutate();
    }, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const agents = data?.agents ?? [];
  const performance = data?.performance;
  const activities = data?.activities ?? [];

  const roleLabel = role === "supplier" ? "Supplier" : role === "distributor" ? "Distributor" : "Retailer";

  return (
    <main className="space-y-6 px-6 py-6 lg:px-8 lg:py-8">
      {/* Header */}
      <section className="flex flex-col gap-4 rounded-3xl border border-[#E2E8F0] bg-white px-6 py-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Badge tone="info">{roleLabel} Intelligence Core</Badge>
            <span className="flex items-center gap-1.5 text-[10px] text-[#64748B]">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${autoTick.isPending ? "bg-green-500 animate-pulse" : "bg-[#CBD5E1]"}`} />
              {autoTick.isPending ? "auto-tick running..." : "auto-tick idle"}
            </span>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-[#0F172A]">AI Agents</h1>
            <p className="max-w-3xl text-sm leading-7 text-[#64748B]">
              {role === "supplier"
                ? "Supply chain optimization, demand prediction, and delivery optimization for suppliers."
                : role === "distributor"
                  ? "Auto restock, retailer credit analysis, supplier recommendations, and cash flow optimization for distributors."
                  : "Smart reorder, sales trend analysis, and consumer demand prediction for retailers."}
            </p>
          </div>
        </div>
      </section>

      {/* Error alert */}
      {runError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-center justify-between">
          <span>{runError}</span>
          <button onClick={() => setRunError(null)} className="text-red-400 hover:text-red-600 font-medium">Dismiss</button>
        </div>
      )}

      {/* KPI cards */}
      {performance && (
        <section className="grid gap-4 md:grid-cols-3">
          <KpiCard
            label="Prediction Accuracy"
            value={`${performance.accuracy_rate}%`}
            meta="Current AI model accuracy"
            tone="success"
            icon={BrainCircuit}
          />
          <KpiCard
            label="Est. Cost Savings"
            value={formatCurrency(performance.cost_savings)}
            meta="Savings from optimization"
            tone="success"
            icon={TrendingUp}
          />
          <KpiCard
            label="Time Saved"
            value={`${performance.time_saved_hours} Hours`}
            meta="Manual task automation"
            tone="info"
            icon={Clock}
          />
        </section>
      )}

      {/* Main content */}
      <section className="grid gap-6 xl:grid-cols-[1fr_0.5fr]">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-[#0F172A]">Active Agents</h2>
          
          {isLoading ? (
            <div className="flex h-32 items-center justify-center rounded-2xl border border-[#E2E8F0] bg-white">
              <Loader2 className="h-5 w-5 animate-spin text-[#94A3B8]" />
            </div>
          ) : isError ? (
            <PageErrorState message="Failed to load AI agents data" onRetry={() => refetch()} />
          ) : agents.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center rounded-2xl border border-[#E2E8F0] bg-white">
              <Bot className="h-8 w-8 text-[#CBD5E1] mb-2" />
              <span className="text-sm font-medium text-[#0F172A]">No agents for this role yet</span>
              <span className="text-xs text-[#94A3B8] mt-1">Make sure the database has been seeded with SQL migration</span>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {agents.map((agent) => (
                <Card key={agent.id} className="rounded-2xl flex flex-col">
                  <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
                    <div className="space-y-1">
                      <CardTitle className="text-base flex items-center gap-2">
                        {agent.name}
                        <Badge tone={statusTone[agent.status]} className="text-[10px] px-1.5 py-0">
                          {statusLabel[agent.status]}
                        </Badge>
                      </CardTitle>
                      <p className="text-sm text-[#64748B] line-clamp-2">{agent.description}</p>
                    </div>
                    <div className="rounded-xl bg-[#EFF6FF] p-2 text-[#2563EB]">
                      <Bot className="h-5 w-5" />
                    </div>
                  </CardHeader>
                  <CardContent className="mt-auto space-y-4 pt-4">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs font-medium text-[#64748B]">Recent Action</p>
                      <p className="mt-1 text-sm text-[#0F172A]">{agent.recent_action}</p>
                    </div>

                    <div className="flex items-center justify-between border-t border-[#E2E8F0] pt-4">
                      <div className="space-y-1">
                        <p className="text-xs text-[#64748B]">Automation Level</p>
                        <select
                          className="h-8 rounded border border-[#E2E8F0] bg-white px-2 text-xs font-medium text-[#0F172A] outline-none"
                          value={agent.automation_level}
                          disabled={updateConfig.isPending}
                          onChange={(e) => {
                            const val = e.target.value as "manual_approval" | "auto_with_threshold" | "auto_execute";
                            updateConfig.mutate({ id: agent.id, automation_level: val });
                          }}
                        >
                          <option value="manual_approval">Manual Approval</option>
                          <option value="auto_with_threshold">Auto with Threshold</option>
                          <option value="auto_execute">Auto Execute</option>
                        </select>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="primary"
                          disabled={runAgent.isPending}
                          onClick={() => {
                            setRunError(null);
                            runAgent.mutate(agent.agent_key, {
                              onError: (err) => setRunError(String(err)),
                              onSuccess: () => setRunError(null),
                            });
                          }}
                          className="h-8 gap-1 text-xs"
                        >
                          {runAgent.isPending && runAgent.variables === agent.agent_key ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Play className="h-3 w-3" />
                          )}
                          Run
                        </Button>
                        <Button 
                          variant={agent.status === "active" ? "secondary" : "primary"}
                          size="sm"
                          disabled={updateConfig.isPending}
                          onClick={() => {
                            const newStatus: AiAgentStatus = agent.status === "active" ? "paused" : "active";
                            updateConfig.mutate({ id: agent.id, status: newStatus });
                          }}
                        >
                          {agent.status === "active" ? "Pause" : "Activate"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Side panel — Activity Log */}
        <div className="space-y-6">
          <Card className="rounded-2xl flex flex-col max-h-[calc(100vh-12rem)]">
            <CardHeader className="space-y-1 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-[#F59E0B]" />
                  <CardTitle className="text-base">Activity Log</CardTitle>
                  <Badge tone="info" className="text-[10px] px-1.5 py-0">{activities.length}</Badge>
                </div>
                {activities.length > 0 && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 text-[10px]"
                    disabled={clearActivities.isPending}
                    onClick={() => clearActivities.mutate()}
                  >
                    {clearActivities.isPending ? "..." : "Clear"}
                  </Button>
                )}
              </div>
              <p className="text-sm text-[#64748B]">
                {role === "supplier" ? "Supply chain & logistics" : role === "distributor" ? "Restock, credit & partnership" : "Demand & sales"}
              </p>
            </CardHeader>
            <CardContent className="overflow-y-auto flex-1 min-h-0">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-[#94A3B8]" />
                </div>
              ) : activities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <Bot className="h-8 w-8 text-[#CBD5E1]" />
                  <p className="text-sm text-[#64748B]">No activity yet</p>
                  <p className="text-xs text-[#94A3B8]">Run an agent to view logs</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activities.map((act) => {
                    const isExpanded = expandedId === act.id;
                    return (
                      <div key={act.id}>
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : act.id)}
                          className="w-full text-left relative pl-5 border-l-2 border-[#E2E8F0] hover:border-[#3B82F6] transition-colors group"
                        >
                          <div className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full border-2 border-white bg-[#3B82F6] group-hover:scale-125 transition-transform" />
                          <div className="space-y-1.5 pb-3">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-semibold text-[#0F172A]">{act.agent_name}</p>
                              <span className="text-[10px] text-[#94A3B8]">
                                {new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(act.timestamp))}
                              </span>
                            </div>
                            <p className="text-xs text-[#64748B] line-clamp-2">{cleanAiText(act.action)}</p>
                            <p className="text-[10px] text-[#94A3B8] line-clamp-1">{cleanAiText(act.impact)}</p>

                            {isExpanded && act.full_result && (
                              <ExpandedResult fullResult={act.full_result} />
                            )}

                            {!isExpanded && (
                              <p className="text-[10px] text-[#3B82F6] font-medium mt-0.5">Click for details</p>
                            )}
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
