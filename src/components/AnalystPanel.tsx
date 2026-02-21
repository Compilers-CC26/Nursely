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
} from "lucide-react";
import type { Patient } from "@/types";
import { generateSBAR, getAnalyticsResults } from "@/services/snowflakeMock";

interface AnalystPanelProps {
  selectedPatient: Patient | null;
}

const agentActions = [
  { icon: Activity, label: "Extract vitals trends", done: true },
  { icon: PenLine, label: "Rewrite query", done: true },
  { icon: ClipboardList, label: "Suggest order sets", done: true },
];

export default function AnalystPanel({ selectedPatient }: AnalystPanelProps) {
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
          {/* Prompt header */}
          <div className="rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 p-4">
            <p className="text-base font-semibold text-foreground leading-snug">
              Explore patients at risk for sepsis
            </p>
          </div>

          {/* Agent actions checklist */}
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
            <Button size="sm" variant="outline" className="flex-1">
              Refine
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
              <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <ClipboardList className="h-4 w-4 text-primary" />
                SBAR Report — {selectedPatient.name}
              </h4>

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
