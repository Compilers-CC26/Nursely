import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckCircle2,
  Activity,
  PenLine,
  ClipboardList,
  Sparkles,
  User,
  MessageSquare,
  ArrowRight,
} from "lucide-react";
import type { Patient } from "@/types";
import { generateSBAR } from "@/services/snowflakeMock";
import { cn } from "@/lib/utils";

interface AnalystPanelProps {
  selectedPatient: Patient | null;
  searchQuery: string;
  onSwitchToChat: (message?: string) => void;
  liveCensus: Patient[];
  onSyncComplete?: (patientId: string) => void;
}

/** Generate a dynamic header based on current context */
function getContextHeader(
  searchQuery: string,
  selectedPatient: Patient | null
): string {
  if (selectedPatient && searchQuery) {
    return `Analyzing ${selectedPatient.name} — filtered by "${searchQuery}"`;
  }
  if (selectedPatient) {
    return `Analyzing ${selectedPatient.name} — ${selectedPatient.diagnosis}`;
  }
  if (searchQuery) {
    return `Explore patients matching "${searchQuery}"`;
  }
  return "Explore your patient cohort";
}

function getAgentActions(
  searchQuery: string,
  selectedPatient: Patient | null
) {
  if (selectedPatient) {
    const firstName = selectedPatient.name.split(" ")[0];
    return [
      { icon: Activity, label: `Extract vitals trends for ${firstName}`, prompt: `Can you extract and analyze the recent vitals trends for ${selectedPatient.name}?` },
      { icon: PenLine, label: "Review medication interactions", prompt: `Are there any severe medication interactions I should be aware of for ${selectedPatient.name} based on their current MAR?` },
      { icon: ClipboardList, label: "Generate care recommendations", prompt: `What are the top nursing care recommendations based on ${selectedPatient.name}'s current diagnosis and labs?` },
    ];
  }
  if (searchQuery) {
    return [
      { icon: Activity, label: `Filter cohort by "${searchQuery}"`, prompt: `Help me analyze the cohort of patients matching "${searchQuery}".` },
      { icon: PenLine, label: "Rank by risk score", prompt: `Can you sort the current cohort by risk score and highlight the most critical patients?` },
      { icon: ClipboardList, label: "Identify high-priority alerts", prompt: `Are there any high-priority alerts or critical lab values in the current patient list I need to address?` },
    ];
  }
  return [
    { icon: Activity, label: "Understand risk scoring", prompt: "How is the patient risk score calculated and what factors are most heavily weighted?" },
    { icon: PenLine, label: "Search tips", prompt: "What are some effective ways to search and filter the patient table?" },
    { icon: ClipboardList, label: "General unit overview", prompt: "Can you give me a general overview of the clinical status of the unit based on the current cohort?" },
  ];
}

export default function AnalystPanel({
  selectedPatient,
  searchQuery,
  onSwitchToChat,
  liveCensus,
  onSyncComplete,
}: AnalystPanelProps) {
  const analytics = useMemo(() => {
    if (!liveCensus || liveCensus.length === 0) {
      return {
        unitCount: 0,
        topDiagnoses: ["None"],
        alerts: ["No data loaded"],
        unitOptions: [],
        riskOptions: []
      };
    }

    const units = new Set(liveCensus.map(p => p.room ? p.room.split('-')[0] : "Unknown"));
    const diagCount: Record<string, number> = {};
    liveCensus.forEach(p => {
      diagCount[p.diagnosis] = (diagCount[p.diagnosis] || 0) + 1;
    });
    const topDiagnoses = Object.entries(diagCount)
      .sort((a,b) => b[1]-a[1])
      .slice(0, 3)
      .map(e => e[0]);

    const highRisk = liveCensus.filter(p => p.riskScore > 0.80).length;
    const criticalLabs = liveCensus.filter(p => p.labs.some(l => l.flag !== "normal")).length;

    return {
      unitCount: units.size,
      topDiagnoses: topDiagnoses.length ? topDiagnoses : ["None"],
      alerts: [
        `${highRisk} patients with Risk Score > 0.80`,
        `${criticalLabs} patients with abnormal labs`
      ],
      unitOptions: Array.from(units).sort(),
      riskOptions: [
        "Critical (>0.85)",
        "High (0.70–0.85)",
        "Moderate (0.50–0.70)",
        "Low (<0.50)",
      ]
    };
  }, [liveCensus]);
  const [showSBAR, setShowSBAR] = useState(false);
  const [refinementQ1, setRefinementQ1] = useState("");
  const [refinementQ2, setRefinementQ2] = useState("");

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ success: boolean; rows?: number; error?: string } | null>(null);

  const sbar = useMemo(() => {
    if (!selectedPatient) return null;
    return generateSBAR(selectedPatient);
  }, [selectedPatient]);

  // Sync patient to Snowflake on selection
  React.useEffect(() => {
    setShowSBAR(false);
    setSyncStatus(null);

    if (selectedPatient) {
      setIsSyncing(true);
      import("@/services/fhirMock").then(({ syncPatientToSnowflake }) => {
        syncPatientToSnowflake(selectedPatient.id)
          .then((result) => {
            if (result) {
              setSyncStatus({ success: result.success, rows: result.rowsWritten, error: result.error });
              if (result.success && onSyncComplete) {
                onSyncComplete(selectedPatient.id);
              }
            }
          })
          .finally(() => setIsSyncing(false));
      });
    }
  }, [selectedPatient?.id, onSyncComplete]);

  const contextHeader = getContextHeader(searchQuery, selectedPatient);
  const agentActions = getAgentActions(searchQuery, selectedPatient);

  // Build a refinement message for the Chat tab
  const buildRefineMessage = () => {
    const parts: string[] = [];
    if (searchQuery) parts.push(`current search: "${searchQuery}"`);
    if (refinementQ1) parts.push(`risk category: ${refinementQ1}`);
    if (refinementQ2) parts.push(`unit: ${refinementQ2}`);
    if (selectedPatient) parts.push(`selected patient: ${selectedPatient.name}`);

    if (parts.length === 0) {
      return "Help me refine the current patient cohort. What filters or criteria should I consider?";
    }
    return `Help me refine my search. Current context: ${parts.join(", ")}. What else should I look at?`;
  };

  return (
    <Card className="flex h-full flex-col border-0 bg-white shadow-none">
      <CardHeader className="space-y-1 pb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg font-semibold">Nurse Analyst</CardTitle>
        </div>
        <CardDescription className="text-xs text-muted-foreground">
          Clinical decision support
        </CardDescription>
      </CardHeader>

      <ScrollArea className="flex-1">
        <CardContent className="space-y-6">
          {/* Dynamic prompt header */}
          <div className="rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 p-4">
            <p className="text-base font-semibold text-foreground leading-snug">
              {contextHeader}
            </p>
            {(searchQuery || selectedPatient) && (
              <button
                onClick={() => onSwitchToChat(`Tell me more about: ${contextHeader}`)}
                className="mt-2 flex items-center gap-1 text-xs text-primary/70 hover:text-primary transition-colors"
                disabled={isSyncing}
              >
                <MessageSquare className="h-3 w-3" />
                Ask the assistant about this
                <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Snowflake Sync Status */}
          {selectedPatient && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                  Snowflake Status
                </h4>
                {isSyncing && (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-amber-600 animate-pulse">
                    <Activity className="h-2.5 w-2.5" />
                    Syncing live data...
                  </span>
                )}
              </div>

              {!isSyncing && syncStatus && (
                <div className={cn(
                  "flex items-center gap-2 rounded-md border px-3 py-2 text-xs transition-all",
                  syncStatus.success
                    ? "bg-emerald-50/50 border-emerald-100 text-emerald-700"
                    : "bg-rose-50/50 border-rose-100 text-rose-700"
                )}>
                  {syncStatus.success ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        Synced to Snowflake ({syncStatus.rows} rows). Ready for RAG query.
                      </span>
                    </>
                  ) : (
                    <>
                      <Activity className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        Sync failed: {syncStatus.error || "Connection error"}.
                        <span className="opacity-70 ml-1">Current session using local fallbacks.</span>
                      </span>
                    </>
                  )}
                </div>
              )}

              {!isSyncing && !syncStatus && (
                <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground italic">
                  <Activity className="h-3.5 w-3.5" />
                  Select a patient to sync live clinical records.
                </div>
              )}
            </div>
          )}

          {/* Agent actions checklist — context-aware */}
          <div className="space-y-2">
            {agentActions.map((action) => (
              <button
                key={action.label}
                onClick={() => action.prompt && onSwitchToChat(action.prompt)}
                className="w-full flex items-center justify-between gap-2.5 rounded-lg border border-border/50 bg-background px-3 py-2.5 text-left hover:bg-muted hover:border-border transition-colors group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10">
                    <action.icon className="h-3.5 w-3.5 text-primary/70 group-hover:text-primary transition-colors" />
                  </div>
                  <span className="text-[13px] font-medium text-foreground/80 group-hover:text-foreground transition-colors truncate">
                    {action.label}
                  </span>
                </div>
                {action.prompt && (
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                )}
              </button>
            ))}
          </div>

          {/* Cohort summary */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Cohort Summary
            </h4>
            <p className="text-sm leading-relaxed text-foreground/80">
              Showing patients across {analytics.unitCount} units.
              Top diagnoses include{" "}
              {analytics.topDiagnoses.join(", ")}.{" "}
              {analytics.alerts[0]}.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {analytics.alerts.map((alert, i) => (
                <Badge key={i} variant="secondary" className="text-xs font-normal">
                  {alert}
                </Badge>
              ))}
            </div>
          </div>

          {/* Clarifying questions */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Two questions to tailor it:
            </h4>

            <div className="space-y-1.5">
              <label className="text-sm text-foreground/80">
                • What risk category are you most interested in?
              </label>
              <select
                value={refinementQ1}
                onChange={(e) => setRefinementQ1(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select...</option>
                {analytics.riskOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm text-foreground/80">
                • Any specific unit or floor to focus on?
              </label>
              <select
                value={refinementQ2}
                onChange={(e) => setRefinementQ2(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">All units</option>
                {analytics.unitOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 gap-1.5"
              onClick={() => onSwitchToChat(buildRefineMessage())}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Refine in Chat
            </Button>
            <Button
              size="sm"
              className="flex-1"
              disabled={!selectedPatient}
              onClick={() => setShowSBAR(true)}
            >
              Generate SBAR
            </Button>
          </div>

          {/* SBAR output */}
          {!selectedPatient && (
            <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              <User className="h-4 w-4 shrink-0" />
              Select a patient to generate SBAR
            </div>
          )}

          {selectedPatient && showSBAR && sbar && (
            <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
              <div className="flex items-center justify-between">
                <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <ClipboardList className="h-4 w-4 text-primary" />
                  SBAR Report — {selectedPatient.name}
                </h4>
                <button
                  onClick={() =>
                    onSwitchToChat(
                      `I just generated an SBAR for ${selectedPatient.name}. Can you help me review and improve it?`
                    )
                  }
                  className="text-xs text-primary/70 hover:text-primary transition-colors flex items-center gap-1"
                >
                  Discuss in Chat
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>

              <div className="space-y-2.5">
                <SBARSection title="Situation" content={sbar.situation} />
                <SBARSection title="Background" content={sbar.background} />
                <SBARSection title="Assessment" content={sbar.assessment} />
                <SBARSection title="Recommendation" content={sbar.recommendation} />
              </div>
            </div>
          )}

          {selectedPatient && !showSBAR && (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{selectedPatient.name}</span> selected.
              Click <span className="font-medium">"Generate SBAR"</span> to create the report.
            </div>
          )}
        </CardContent>
      </ScrollArea>
    </Card>
  );
}

function SBARSection({ title, content }: { title: string; content: string }) {
  return (
    <div>
      <span className="text-xs font-bold uppercase tracking-wider text-primary">{title}</span>
      <p className="mt-0.5 text-sm leading-relaxed text-foreground/80">{content}</p>
    </div>
  );
}
