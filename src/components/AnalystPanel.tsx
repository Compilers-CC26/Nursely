import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clipboard,
  ClipboardCheck,
  Users,
} from "lucide-react";
import type { Patient } from "@/types";
import { cn } from "@/lib/utils";

interface AnalystPanelProps {
  selectedPatient: Patient | null;
  searchQuery: string;
  onSwitchToChat: (message?: string) => void;
  liveCensus: Patient[];
  onSyncComplete?: (patientId: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Vital sign thresholds  (match RRT activation criteria in KB-004)
// ─────────────────────────────────────────────────────────────────────────────
type Severity = "critical" | "warning" | "normal";

function hrSeverity(v: number | null): Severity {
  if (v == null) return "normal";
  if (v > 120 || v < 50) return "critical";
  if (v > 100 || v < 60) return "warning";
  return "normal";
}
function bpSeverity(sys: number | null): Severity {
  if (sys == null) return "normal";
  if (sys > 180 || sys < 80) return "critical";
  if (sys > 140 || sys < 90) return "warning";
  return "normal";
}
function rrSeverity(v: number | null): Severity {
  if (v == null) return "normal";
  if (v > 28 || v < 10) return "critical";
  if (v > 20 || v < 12) return "warning";
  return "normal";
}
function tempSeverity(v: number | null): Severity {
  if (v == null) return "normal";
  if (v > 103 || v < 96) return "critical";
  if (v > 100.4 || v < 97) return "warning";
  return "normal";
}
function spo2Severity(v: number | null): Severity {
  if (v == null) return "normal";
  if (v < 90) return "critical";
  if (v < 94) return "warning";
  return "normal";
}

const SEV: Record<Severity, string> = {
  critical: "bg-red-50 border-red-200 text-red-700",
  warning: "bg-amber-50 border-amber-200 text-amber-700",
  normal: "bg-muted/40 border-border/50 text-foreground/70",
};

// ─────────────────────────────────────────────────────────────────────────────
// Vital chip — color-coded inline vital sign tile
// ─────────────────────────────────────────────────────────────────────────────
function VitalChip({
  label,
  value,
  severity,
}: {
  label: string;
  value: string | null;
  severity: Severity;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-lg border px-2.5 py-1.5 min-w-[62px]",
        SEV[severity],
      )}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider opacity-50">
        {label}
      </span>
      {value != null ? (
        <span className="text-sm font-bold tabular-nums leading-tight">
          {value}
        </span>
      ) : (
        <span className="text-xs font-normal opacity-30 leading-tight">—</span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SBAR builder — pure, computed from live Patient object, no mock service
// ─────────────────────────────────────────────────────────────────────────────
function buildSBAR(p: Patient) {
  const dx =
    p.diagnosis && !/no active|unknown|undocumented/i.test(p.diagnosis)
      ? p.diagnosis
      : "undocumented condition";

  const vitalsStr = [
    p.vitals.hr != null ? `HR ${p.vitals.hr}` : null,
    p.vitals.bpSys != null && p.vitals.bpDia != null
      ? `BP ${p.vitals.bpSys}/${p.vitals.bpDia}`
      : null,
    p.vitals.rr != null ? `RR ${p.vitals.rr}` : null,
    p.vitals.temp != null ? `Temp ${p.vitals.temp}°F` : null,
    p.vitals.spo2 != null ? `SpO2 ${p.vitals.spo2}%` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const abnormalLabs = p.labs
    .filter((l) => l.flag !== "normal")
    .map((l) => `${l.name} ${l.value}${l.unit ? " " + l.unit : ""} (${l.flag})`)
    .join("; ");

  const medsStr = p.meds.length
    ? p.meds.slice(0, 5).join(", ") +
      (p.meds.length > 5 ? ` +${p.meds.length - 5} more` : "")
    : "none documented";

  return {
    situation: `${p.name}, ${p.age}yo ${p.sex === "F" ? "female" : "male"}, Room ${p.room}. Primary diagnosis: ${dx}. Risk score ${p.riskScore.toFixed(2)}.`,
    background: `Current medications: ${medsStr}. Allergies: ${p.allergies.length ? p.allergies.join(", ") : "NKDA"}.${p.notes.length ? " Recent note: " + p.notes[0] : ""}`,
    assessment: `${vitalsStr ? "Vitals: " + vitalsStr + "." : "No recent vitals on file."} ${abnormalLabs ? "Abnormal labs: " + abnormalLabs + "." : "Labs within normal limits."}`,
    recommendation:
      p.riskScore > 0.8
        ? `ALERT: High acuity — notify attending, consider rapid response assessment. Reassess vitals within 1 hour.`
        : `Continue current plan of care. Reassess at next rounding. Report status to oncoming shift.`,
  };
}

function sbarToClipboard(
  p: Patient,
  sbar: ReturnType<typeof buildSBAR>,
): string {
  return (
    `SBAR — ${p.name} (Room ${p.room})\n\n` +
    `SITUATION: ${sbar.situation}\n\n` +
    `BACKGROUND: ${sbar.background}\n\n` +
    `ASSESSMENT: ${sbar.assessment}\n\n` +
    `RECOMMENDATION: ${sbar.recommendation}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// "Needs Attention" reasons — critical vitals or labs
// ─────────────────────────────────────────────────────────────────────────────
function getAttentionReasons(p: Patient): string[] {
  const reasons: string[] = [];
  const v = p.vitals;
  if (hrSeverity(v.hr) === "critical") reasons.push(`HR ${v.hr}`);
  if (bpSeverity(v.bpSys) === "critical")
    reasons.push(`BP ${v.bpSys}/${v.bpDia}`);
  if (spo2Severity(v.spo2) === "critical") reasons.push(`SpO2 ${v.spo2}%`);
  if (rrSeverity(v.rr) === "critical") reasons.push(`RR ${v.rr}`);
  if (tempSeverity(v.temp) === "critical") reasons.push(`Temp ${v.temp}°F`);
  const critLabs = p.labs.filter((l) => l.flag === "critical");
  if (critLabs.length)
    reasons.push(
      `${critLabs.length} critical lab${critLabs.length > 1 ? "s" : ""}`,
    );
  return reasons;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function AnalystPanel({
  selectedPatient,
  onSwitchToChat,
  liveCensus,
}: AnalystPanelProps) {
  const [copied, setCopied] = useState(false);

  // SBAR always pre-computed when a patient is selected — no button click needed
  const sbar = useMemo(
    () => (selectedPatient ? buildSBAR(selectedPatient) : null),
    [selectedPatient],
  );

  const handleCopySBAR = () => {
    if (!selectedPatient || !sbar) return;
    navigator.clipboard
      .writeText(sbarToClipboard(selectedPatient, sbar))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
  };

  // Unit-level analytics — derived from live census, same risk thresholds as table badges
  const unitStats = useMemo(() => {
    if (!liveCensus.length) return null;
    const total = liveCensus.length;
    const high = liveCensus.filter((p) => p.riskScore > 0.65).length;
    const mod = liveCensus.filter(
      (p) => p.riskScore > 0.4 && p.riskScore <= 0.65,
    ).length;
    const low = total - high - mod;

    const attention = liveCensus
      .filter((p) => p.riskScore > 0.65 || getAttentionReasons(p).length > 0)
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 5);

    const diagCount: Record<string, number> = {};
    liveCensus.forEach((p) => {
      if (!p.diagnosis || /no active|unknown|undocumented/i.test(p.diagnosis))
        return;
      diagCount[p.diagnosis] = (diagCount[p.diagnosis] || 0) + 1;
    });
    const topDx = Object.entries(diagCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    return { total, high, mod, low, attention, topDx };
  }, [liveCensus]);

  // ── MODE A: Patient selected ─────────────────────────────────────────────
  if (selectedPatient) {
    const p = selectedPatient;
    const v = p.vitals;
    const flaggedLabs = p.labs.filter((l) => l.flag !== "normal");

    return (
      <div className="p-4 space-y-4">
        {/* Patient header */}
        <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-primary/10 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary/60">
                Room {p.room}
              </p>
              <p className="mt-0.5 truncate text-base font-bold leading-tight text-foreground">
                {p.name}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {p.age}yo {p.sex === "F" ? "Female" : "Male"} · MRN {p.mrn}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold tabular-nums",
                  p.riskScore > 0.65
                    ? "bg-red-50 border-red-200 text-red-700"
                    : p.riskScore > 0.4
                      ? "bg-amber-50 border-amber-200 text-amber-700"
                      : "bg-emerald-50 border-emerald-200 text-emerald-700",
                )}
              >
                Risk {p.riskScore.toFixed(2)}
              </span>
              <p className="mt-1 max-w-[130px] text-right text-[10px] leading-snug text-muted-foreground">
                {p.diagnosis &&
                !/no active|unknown|undocumented/i.test(p.diagnosis)
                  ? p.diagnosis
                  : "No active diagnosis"}
              </p>
            </div>
          </div>
        </div>

        {/* Vitals — color-coded chips, no clicks required */}
        <div className="space-y-2">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
            Latest Vitals
          </h4>
          <div className="flex flex-wrap gap-1.5">
            <VitalChip
              label="HR"
              value={v.hr != null ? String(v.hr) : null}
              severity={hrSeverity(v.hr)}
            />
            <VitalChip
              label="BP"
              value={
                v.bpSys != null && v.bpDia != null
                  ? `${v.bpSys}/${v.bpDia}`
                  : null
              }
              severity={bpSeverity(v.bpSys)}
            />
            <VitalChip
              label="SpO2"
              value={v.spo2 != null ? `${v.spo2}%` : null}
              severity={spo2Severity(v.spo2)}
            />
            <VitalChip
              label="RR"
              value={v.rr != null ? String(v.rr) : null}
              severity={rrSeverity(v.rr)}
            />
            <VitalChip
              label="Temp"
              value={v.temp != null ? `${v.temp}°` : null}
              severity={tempSeverity(v.temp)}
            />
          </div>
        </div>

        {/* Labs — only abnormal results shown */}
        <div className="space-y-2">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
            Labs
          </h4>
          {flaggedLabs.length > 0 ? (
            <div className="space-y-1.5">
              {flaggedLabs.map((lab, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-center justify-between rounded-lg border px-3 py-2 text-xs",
                    lab.flag === "critical"
                      ? "bg-red-50 border-red-200 text-red-700"
                      : lab.flag === "high" || lab.flag === "low"
                        ? "bg-amber-50 border-amber-200 text-amber-700"
                        : "bg-muted/30 border-border/50",
                  )}
                >
                  <span className="font-medium">{lab.name}</span>
                  <span className="tabular-nums font-bold">
                    {lab.value}
                    {lab.unit ? ` ${lab.unit}` : ""}
                    <span className="ml-1.5 text-[10px] font-semibold uppercase opacity-60">
                      [{lab.flag}]
                    </span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-2 text-xs text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              All labs within normal limits
            </div>
          )}
        </div>

        {/* SBAR — always visible, no button click required */}
        {sbar && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                SBAR
              </h4>
              <button
                onClick={handleCopySBAR}
                className={cn(
                  "flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold transition-colors",
                  copied
                    ? "bg-emerald-50 text-emerald-600"
                    : "text-primary/70 hover:bg-primary/5 hover:text-primary",
                )}
              >
                {copied ? (
                  <>
                    <ClipboardCheck className="h-3 w-3" />
                    Copied
                  </>
                ) : (
                  <>
                    <Clipboard className="h-3 w-3" />
                    Copy
                  </>
                )}
              </button>
            </div>

            <div className="divide-y divide-border/50 overflow-hidden rounded-xl border bg-muted/20 text-xs">
              {(
                [
                  "situation",
                  "background",
                  "assessment",
                  "recommendation",
                ] as const
              ).map((key) => (
                <div key={key} className="px-3 py-2.5">
                  <span
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-wider",
                      key === "recommendation" &&
                        sbar.recommendation.startsWith("ALERT")
                        ? "text-red-600"
                        : "text-primary/70",
                    )}
                  >
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                  </span>
                  <p className="mt-0.5 leading-relaxed text-foreground/80">
                    {sbar[key]}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="flex gap-2 pb-2">
          <button
            onClick={() =>
              onSwitchToChat(
                `What are the key clinical concerns for ${p.name} right now based on their current vitals, labs, and diagnosis?`,
              )
            }
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
          >
            Ask AI
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() =>
              onSwitchToChat(
                `I generated this SBAR for ${p.name} — please review it and suggest any clinical improvements:\n\n${sbarToClipboard(p, sbar!)}`,
              )
            }
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border/50 bg-background px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Review SBAR
          </button>
        </div>
      </div>
    );
  }

  // ── MODE B: Unit overview (no patient selected) ──────────────────────────
  if (!unitStats) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
        <div>
          <Users className="mx-auto mb-2 h-8 w-8 opacity-20" />
          Loading census data…
        </div>
      </div>
    );
  }

  const { total, high, mod, low, attention, topDx } = unitStats;
  const highPct = Math.round((high / total) * 100);
  const modPct = Math.round((mod / total) * 100);
  const lowPct = 100 - highPct - modPct;

  const unitQuestions = [
    "Which patients have abnormal vitals since last rounding?",
    "Who is at highest fall risk right now?",
    "Which patients are on antibiotics and for how long?",
    "Are there any patients due for pain reassessment?",
  ];

  return (
    <div className="p-4 space-y-5 pb-6">
      {/* Unit health bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
            Unit Overview
          </h4>
          <span className="text-[10px] text-muted-foreground">
            {total} patients
          </span>
        </div>
        <div className="flex h-2.5 w-full overflow-hidden rounded-full border border-border/40 bg-muted/40">
          {highPct > 0 && (
            <div
              className="bg-red-400 transition-all"
              style={{ width: `${highPct}%` }}
            />
          )}
          {modPct > 0 && (
            <div
              className="bg-amber-400 transition-all"
              style={{ width: `${modPct}%` }}
            />
          )}
          {lowPct > 0 && (
            <div
              className="bg-emerald-400 transition-all"
              style={{ width: `${lowPct}%` }}
            />
          )}
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <span className="flex items-center gap-1 font-semibold text-red-600">
            <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
            {high} High
          </span>
          <span className="flex items-center gap-1 font-semibold text-amber-600">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
            {mod} Mod
          </span>
          <span className="flex items-center gap-1 font-semibold text-emerald-600">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
            {low} Low
          </span>
        </div>
      </div>

      {/* Needs attention */}
      {attention.length > 0 && (
        <div className="space-y-2">
          <h4 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
            <AlertTriangle className="h-3 w-3 text-red-500" />
            Needs Attention
          </h4>
          <div className="space-y-1.5">
            {attention.map((p) => {
              const reasons = getAttentionReasons(p);
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-2.5 rounded-lg border border-border/50 bg-background px-3 py-2"
                >
                  <div
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      p.riskScore > 0.8 ? "bg-red-500" : "bg-amber-400",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-foreground">
                      {p.name}
                    </p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      Rm {p.room} ·{" "}
                      {reasons.length
                        ? reasons.join(", ")
                        : `Risk ${p.riskScore.toFixed(2)}`}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      onSwitchToChat(
                        `What are the clinical concerns for ${p.name} right now?`,
                      )
                    }
                    className="shrink-0 text-muted-foreground/30 transition-colors hover:text-primary"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top conditions — clickable to ask AI about that condition group */}
      {topDx.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
            Top Conditions
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {topDx.map(([dx, count]) => (
              <button
                key={dx}
                onClick={() =>
                  onSwitchToChat(
                    `Which patients on the unit have ${dx}? Summarize the key nursing considerations for this group.`,
                  )
                }
                className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-muted/30 px-2.5 py-1 text-[11px] font-medium text-foreground/80 transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
              >
                {dx}
                <span className="text-muted-foreground/50">{count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quick questions */}
      <div className="space-y-2">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
          Quick Questions
        </h4>
        <div className="space-y-1.5">
          {unitQuestions.map((q) => (
            <button
              key={q}
              onClick={() => onSwitchToChat(q)}
              className="group flex w-full items-center gap-2 rounded-lg border border-border/50 bg-background px-3 py-2.5 text-left transition-colors hover:border-border hover:bg-muted"
            >
              <span className="flex-1 text-[12px] leading-snug text-foreground/80 transition-colors group-hover:text-foreground">
                {q}
              </span>
              <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/30 transition-colors group-hover:text-primary" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
