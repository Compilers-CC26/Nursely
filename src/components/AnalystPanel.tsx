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
import { generateSBAR, getAnalyticsResults } from "@/services/snowflakeMock";

interface AnalystPanelProps {
  selectedPatient: Patient | null;
  searchQuery: string;
  onSwitchToChat: (message?: string) => void;
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

/** Generate context-aware agent actions */
function getAgentActions(
  searchQuery: string,
  selectedPatient: Patient | null
) {
  if (selectedPatient) {
    return [
      { icon: Activity, label: `Extract vitals trends for ${selectedPatient.name.split(" ")[0]}`, done: true },
      { icon: PenLine, label: "Review medication interactions", done: true },
      { icon: ClipboardList, label: "Generate care recommendations", done: true },
    ];
  }
  if (searchQuery) {
    return [
      { icon: Activity, label: `Filter cohort by "${searchQuery}"`, done: true },
      { icon: PenLine, label: "Rank by risk score", done: true },
      { icon: ClipboardList, label: "Identify high-priority alerts", done: true },
    ];
  }
  return [
    { icon: Activity, label: "Extract vitals trends", done: true },
    { icon: PenLine, label: "Rewrite query", done: true },
    { icon: ClipboardList, label: "Suggest order sets", done: true },
  ];
}

export default function AnalystPanel({
  selectedPatient,
  searchQuery,
  onSwitchToChat,
}: AnalystPanelProps) {
  const analytics = useMemo(() => getAnalyticsResults(), []);
  const [showSBAR, setShowSBAR] = useState(false);
  const [refinementQ1, setRefinementQ1] = useState("");
  const [refinementQ2, setRefinementQ2] = useState("");

  const sbar = useMemo(() => {
    if (!selectedPatient) return null;
    return generateSBAR(selectedPatient);
  }, [selectedPatient]);

  // Reset SBAR display when patient changes
  React.useEffect(() => {
    setShowSBAR(false);
  }, [selectedPatient?.id]);

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
              >
                <MessageSquare className="h-3 w-3" />
                Ask the assistant about this
                <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Agent actions checklist — context-aware */}
          <div className="space-y-2">
            {agentActions.map((action) => (
              <div key={action.label} className="flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                <span className="text-sm text-muted-foreground">{action.label}</span>
              </div>
            ))}
          </div>

          {/* Cohort summary */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Cohort Summary
            </h4>
            <p className="text-sm leading-relaxed text-foreground/80">
              Showing patients across {analytics.suggestedFilters[0]?.options.length ?? 0} units.
              Top diagnoses include{" "}
              {analytics.cohortSummary.topDiagnoses.slice(0, 3).join(", ")}.{" "}
              {analytics.cohortSummary.alerts[0]}.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {analytics.cohortSummary.alerts.map((alert, i) => (
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
                {analytics.suggestedFilters
                  .find((f) => f.label === "Risk Category")
                  ?.options.map((opt) => (
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
                {analytics.suggestedFilters
                  .find((f) => f.label === "Unit / Floor")
                  ?.options.map((opt) => (
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
