import type { Patient } from "@/types";
import { askSnowflakeQuestion } from "@/services/snowflakeMock";

// ─────────────────────────────────────────────────────────────────────────────
// Public interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface Citation {
  title: string;
  source: string;
  url: string;
  content?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  timestamp: Date;
}

export interface FilterCommand {
  type: "search" | "risk" | "flag" | "clear";
  text?: string;
  riskMin?: number;
  riskMax?: number;
  flag?: "antibiotics" | "fall-risk" | "critical-labs" | "high-risk";
  label: string;
}

export interface ChatResponse {
  content: string;
  citations: Citation[];
  filterCommand?: FilterCommand;
}

export interface GenerateResponseResult {
  response: ChatResponse;
  /** Set when the user names a patient not currently selected. */
  matchedPatient?: Patient;
}

// ─────────────────────────────────────────────────────────────────────────────
// Keyword lists (still used by buildCensusRoster flags + App.tsx filters)
// ─────────────────────────────────────────────────────────────────────────────

export const ANTIBIOTIC_KEYWORDS = [
  "vancomycin",
  "ceftriaxone",
  "cefazolin",
  "cefepime",
  "meropenem",
  "piperacillin",
  "tazobactam",
  "ciprofloxacin",
  "levofloxacin",
  "azithromycin",
  "amoxicillin",
  "ampicillin",
  "doxycycline",
  "clindamycin",
  "metronidazole",
  "trimethoprim",
  "sulfamethoxazole",
  "nitrofurantoin",
  "linezolid",
];

export const FALL_RISK_MED_KEYWORDS = [
  "morphine",
  "oxycodone",
  "hydrocodone",
  "fentanyl",
  "codeine",
  "tramadol",
  "hydromorphone",
  "lorazepam",
  "diazepam",
  "midazolam",
  "alprazolam",
  "clonazepam",
  "zolpidem",
  "temazepam",
  "haloperidol",
  "quetiapine",
  "olanzapine",
  "furosemide",
  "lisinopril",
  "amlodipine",
  "metoprolol",
  "carvedilol",
  "hydralazine",
  "prazosin",
  "doxazosin",
  "tizanidine",
];

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function getEffectiveDiagnosis(p: Patient): string | null {
  const bad = new Set([
    "",
    "unknown",
    "no active conditions",
    "undocumented",
    "not documented",
  ]);
  const dx = (p.diagnosis ?? "").trim();
  if (dx && !bad.has(dx.toLowerCase())) return dx;
  if (p.summary) {
    const m = p.summary.match(/Active conditions:\s*([^;\n]+)/i);
    if (m) {
      const extracted = m[1].trim();
      if (
        extracted &&
        !bad.has(extracted.toLowerCase()) &&
        extracted !== "Unknown condition"
      )
        return extracted;
    }
  }
  return null;
}

function detectNamedPatient(
  lowerMsg: string,
  census: Patient[],
): Patient | null {
  for (const p of census) {
    const full = p.name.toLowerCase();
    if (lowerMsg.includes(full)) return p;
    const parts = full.split(/\s+/);
    const last = parts[parts.length - 1];
    if (last.length >= 5 && lowerMsg.includes(last)) return p;
  }
  return null;
}

/**
 * Build a compact census roster with actual vitals so the AI can reason about
 * specific values (e.g. "patients with BP > 180") rather than just flag codes.
 */
function buildCensusRoster(census: Patient[]): string {
  const n = (val: number | null) => (val !== null ? String(val) : "?");

  const lines = [...census]
    .sort((a, b) => b.riskScore - a.riskScore)
    .map((p) => {
      const dx = getEffectiveDiagnosis(p) ?? "?";
      const v = p.vitals;
      const vLine = `BP:${n(v.bpSys)}/${n(v.bpDia)},HR:${n(v.hr)},SpO2:${n(v.spo2)}%,T:${n(v.temp)},RR:${n(v.rr)}`;

      const allMeds = p.meds.map((m) => m.toLowerCase());
      const flags: string[] = [];
      if (p.riskScore > 0.65) flags.push("HiRisk");
      if (p.labs.some((l) => l.flag === "critical")) flags.push("CritLab");
      else if (p.labs.some((l) => l.flag === "high" || l.flag === "low"))
        flags.push("AbnLab");
      if (v.hr !== null && (v.hr > 120 || v.hr < 50)) flags.push("HR!");
      if (v.bpSys !== null && v.bpSys < 80) flags.push("BP!");
      else if (v.bpSys !== null && (v.bpSys < 90 || v.bpSys > 180))
        flags.push("BP~");
      if (v.spo2 !== null && v.spo2 < 90) flags.push("SpO2!");
      else if (v.spo2 !== null && v.spo2 < 94) flags.push("SpO2~");
      if (v.rr !== null && (v.rr > 28 || v.rr < 10)) flags.push("RR!");
      if (v.temp !== null && v.temp > 103) flags.push("Temp!");
      else if (v.temp !== null && v.temp > 100.4) flags.push("Fever");
      if (allMeds.some((m) => ANTIBIOTIC_KEYWORDS.some((kw) => m.includes(kw))))
        flags.push("ABX");
      if (
        allMeds.some((m) => FALL_RISK_MED_KEYWORDS.some((kw) => m.includes(kw)))
      )
        flags.push("FallRx");

      const medsShort =
        p.meds.slice(0, 3).join("/") +
        (p.meds.length > 3 ? `+${p.meds.length - 3}` : "");

      return (
        `${p.name}|${p.age}|Rm${p.room}|${dx}|R:${p.riskScore.toFixed(2)}` +
        `|${vLine}` +
        (medsShort ? `|Rx:${medsShort}` : "|Rx:none") +
        (flags.length ? `|[${flags.join(",")}]` : "")
      );
    })
    .join("\n");

  return (
    `[UNIT CENSUS — ${census.length} patients. Format: Name|Age|Room|Dx|Risk|Vitals|Meds|Flags. ` +
    `Normal ranges: BP 90-140 systolic, HR 60-100, SpO2≥94%, Temp 97-100.4°F, RR 12-20.]\n` +
    lines
  );
}

function buildLivePatientContext(p: Patient): string {
  const v = p.vitals;
  const fmt = (val: number | null, unit: string) =>
    val !== null ? `${val} ${unit}` : "N/A";
  const vitalsLine = v
    ? `HR=${fmt(v.hr, "bpm")}, BP=${v.bpSys != null && v.bpDia != null ? `${v.bpSys}/${v.bpDia} mmHg` : "N/A"}, Temp=${fmt(v.temp, "°F")}, SpO2=${fmt(v.spo2, "%")}, RR=${fmt(v.rr, "/min")}${v.timestamp ? ` (recorded ${new Date(v.timestamp).toLocaleString()})` : ""}`
    : "No vitals on file";
  const labLines =
    p.labs.length > 0
      ? p.labs
          .map(
            (l) =>
              `${l.name}: ${l.value} ${l.unit}${l.flag !== "normal" ? ` [${l.flag.toUpperCase()}]` : ""}`,
          )
          .join("; ")
      : "No labs on file";
  return [
    `PATIENT: ${p.name}, ${p.age}yo ${p.sex}, Room ${p.room}, MRN ${p.mrn}`,
    `DIAGNOSIS: ${p.diagnosis || "No active conditions"}`,
    `VITALS: ${vitalsLine}`,
    `LABS: ${labLines}`,
    `MEDICATIONS: ${p.meds.length > 0 ? p.meds.join(", ") : "None documented"}`,
    `ALLERGIES: ${p.allergies.length > 0 ? p.allergies.join(", ") : "NKDA"}`,
  ].join("\n");
}

type SFResponse = ChatResponse | { error: string };

async function askSnowflakeCohortQuestion(
  question: string,
): Promise<SFResponse | null> {
  if (typeof window === "undefined" || !window.electronAPI?.snowflake)
    return { error: "Snowflake IPC not available (not running in Electron)" };
  try {
    const result = await window.electronAPI!.snowflake.query(
      undefined,
      question,
    );
    if (result.success)
      return {
        content: result.answer ?? "",
        citations: result.citations || [],
      };
    return {
      error: result.error ?? "Snowflake returned an unsuccessful response",
    };
  } catch (e: any) {
    return { error: e?.message ?? "Snowflake connection error" };
  }
}

function sfRace<T>(p: Promise<T | null>): Promise<T | null> {
  return Promise.race([
    p,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 60000)),
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────────────────────

export async function generateResponse(
  message: string,
  _selectedPatient: Patient | null,
  _conversationHistory: ChatMessage[],
  _liveCensus: Patient[] = [],
): Promise<GenerateResponseResult> {
  const lower = message.toLowerCase();

  // Who are we talking about?
  const namedPatient =
    _liveCensus.length > 0 ? detectNamedPatient(lower, _liveCensus) : null;
  const effectivePatient = _selectedPatient ?? namedPatient;
  const didMatchNewPatient =
    namedPatient != null && namedPatient.id !== _selectedPatient?.id;

  function wrap(cr: ChatResponse): GenerateResponseResult {
    if (didMatchNewPatient) {
      return {
        response: {
          ...cr,
          content: `*Pulled up **${namedPatient!.name}**'s chart.*\n\n${cr.content}`,
        },
        matchedPatient: namedPatient!,
      };
    }
    return { response: cr };
  }

  // ── 1. Explicit filter / table commands ─────────────────────────────────────
  // Only intercept unambiguous "show me only X" style commands so the table
  // updates instantly — everything else goes straight to the AI.
  const filterIntent = detectFilterIntent(message);
  if (filterIntent) {
    const desc =
      filterIntent.type === "clear"
        ? "Filter cleared — showing all patients."
        : filterIntent.type === "search"
          ? `Filtering to patients matching **${filterIntent.text}**.`
          : filterIntent.type === "risk"
            ? `Filtering to **${filterIntent.label}** patients.`
            : `Filtering to patients flagged **${filterIntent.label}**.`;
    return wrap({
      content:
        desc +
        (filterIntent.type !== "clear"
          ? "\n\nClick × above the table to clear."
          : ""),
      citations: [],
      filterCommand: filterIntent,
    });
  }

  // ── 2. Send to AI ────────────────────────────────────────────────────────────
  // Cohort intent: no specific patient, or question explicitly about the unit/census.
  const isCohort =
    !effectivePatient ||
    /\b(all patients|unit|floor|census|everyone|which patients|who (is|are)|how many|list|rank|highest|sickest|most critical|most urgent)\b/i.test(
      lower,
    );

  try {
    if (isCohort) {
      let prompt = message;
      if (effectivePatient) {
        prompt = `Regarding ${effectivePatient.name} (Dx: ${effectivePatient.diagnosis}, Risk: ${effectivePatient.riskScore.toFixed(2)}): ${message}`;
      }
      if (_liveCensus.length > 0) {
        const roster = buildCensusRoster(_liveCensus);
        prompt = `${roster}\n\nNURSE QUESTION: ${prompt}`;
      }
      const result = await sfRace(askSnowflakeCohortQuestion(prompt));
      if (result && "error" in result) {
        return wrap({
          content: `Unable to reach AI: ${result.error}`,
          citations: [],
        });
      }
      if (result) return wrap(result as ChatResponse);
      // sfRace returned null — 60s timeout
      return wrap({
        content:
          "AI did not respond in time (60 s). Snowflake Cortex may be cold-starting — please try again in a moment.",
        citations: [],
      });
    } else {
      const context = buildLivePatientContext(effectivePatient!);
      const prompt = `[LIVE EHR DATA — authoritative source for vitals, labs, and medications]\n${context}\n\nNURSE QUESTION: ${message}`;
      const sfResult = await sfRace(
        askSnowflakeQuestion(effectivePatient!.id, prompt),
      );
      if (sfResult) {
        return wrap({
          content: sfResult.answer,
          citations: sfResult.citations.map((c) => ({
            title: c.title,
            source: c.source,
            url: c.url,
          })),
        });
      }
      // sfRace returned null — 60s timeout
      return wrap({
        content:
          "AI did not respond in time (60 s). Snowflake Cortex may be cold-starting — please try again in a moment.",
        citations: [],
      });
    }
  } catch (e: any) {
    return wrap({
      content: `AI error: ${e?.message ?? "unknown error"}`,
      citations: [],
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter intent detection
// Only fires for unambiguous "filter/show only X" commands.
// ─────────────────────────────────────────────────────────────────────────────

export function detectFilterIntent(message: string): FilterCommand | null {
  const lower = message.toLowerCase();

  // Clear
  if (
    /\b(clear|remove|reset)\b.*\b(filter|search)\b/i.test(lower) ||
    /\bshow\s+all\s+patients\b/i.test(lower)
  ) {
    return { type: "clear", label: "All patients" };
  }

  const hasFilterVerb =
    /\b(show|filter|narrow|display|limit|find|give me|pull up)\b/.test(lower) &&
    /\b(only|just|to|me|down|patients?|with|having)\b/.test(lower);
  if (!hasFilterVerb) return null;

  // Risk tiers
  if (/high[- ]?risk|risk.*high/i.test(lower))
    return { type: "risk", riskMin: 0.65, label: "High risk (score > 0.65)" };
  if (/low[- ]?risk|risk.*low/i.test(lower))
    return { type: "risk", riskMax: 0.4, label: "Low risk (score < 0.40)" };
  if (/mod(?:erate)?[- ]?risk|medium[- ]?risk/i.test(lower))
    return {
      type: "risk",
      riskMin: 0.4,
      riskMax: 0.65,
      label: "Moderate risk (0.40–0.65)",
    };

  // Clinical flags
  if (/antibiotic/i.test(lower))
    return { type: "flag", flag: "antibiotics", label: "On antibiotics" };
  if (/fall[- ]?risk|at.?risk.?fall/i.test(lower))
    return { type: "flag", flag: "fall-risk", label: "Fall-risk medications" };
  if (/critical[- ]?lab|lab.*critical/i.test(lower))
    return { type: "flag", flag: "critical-labs", label: "Critical labs" };

  // Diagnosis / free-text search
  const dxMatch =
    lower.match(
      /\b(?:show|filter|narrow|find|display|give me|pull up)\b.*?\bpatients?\b.*?\b(?:with|having|for|who have|diagnosed with|that have)\s+([a-z][a-z0-9\s\-]{2,40}?)(?:\s*$|\s+and\b|\s+or\b)/,
    ) ??
    lower.match(
      /\b(?:show|filter|narrow|find|display)\b.*?\b(?:with|having|for)\s+([a-z][a-z0-9\s\-]{2,40}?)(?:\s*$|\s+patients?)/,
    );
  if (dxMatch) {
    const term = dxMatch[1].trim();
    if (term.length > 2)
      return { type: "search", text: term, label: `"${term}"` };
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Smart column batch scoring
// ─────────────────────────────────────────────────────────────────────────────

export async function runQueryColumnBatch(
  question: string,
  census: Patient[],
): Promise<{ results: Map<string, string>; error?: string }> {
  if (!census.length)
    return { results: new Map(), error: "No patients in census" };

  if (!window.electronAPI?.snowflake?.classify)
    return {
      results: new Map(),
      error: "Snowflake IPC not available (not running in Electron)",
    };

  const rosterLines = census.map((p) => {
    const dx = getEffectiveDiagnosis(p) ?? "No active dx";
    const medsShort =
      p.meds.length > 0
        ? p.meds.slice(0, 5).join(", ") +
          (p.meds.length > 5 ? ` +${p.meds.length - 5} more` : "")
        : "None";
    const abnormalLabs = p.labs
      .filter((l) => l.flag && l.flag !== "normal")
      .slice(0, 4)
      .map((l) => `${l.name} [${l.flag}]`)
      .join(", ");
    return (
      `- ${p.name} | Age ${p.age} | Dx: ${dx}` +
      ` | Meds: ${medsShort}` +
      (abnormalLabs ? ` | Abnormal labs: ${abnormalLabs}` : "")
    );
  });

  const prompt =
    `You are a JSON-only classification engine. Output ONLY a JSON object. No explanations, no markdown, no prose.\n\n` +
    `TASK: For each patient below, output exactly one label based on whether the clinical question applies.\n` +
    `Allowed labels: YES | POSSIBLE | NO | N/A\n` +
    `  YES      = strong direct evidence in the data\n` +
    `  POSSIBLE = indirect or partial evidence\n` +
    `  NO       = no matching evidence (use as default when unsure)\n` +
    `  N/A      = completely insufficient data to judge\n\n` +
    `CLINICAL QUESTION: ${question}\n\n` +
    `PATIENTS:\n${rosterLines.join("\n")}\n\n` +
    `OUTPUT FORMAT (copy this exactly, replace labels only):\n` +
    `{"${census[0].name}": "YES", "${census[1]?.name ?? census[0].name}": "NO"}\n\n` +
    `FULL JSON RESPONSE (all ${census.length} patients, nothing else):`;

  let raw: string;
  try {
    const result = await window.electronAPI.snowflake.classify(prompt);
    if (!result.success || !result.answer)
      return {
        results: new Map(),
        error: result.error ?? "Snowflake classify call failed",
      };
    raw = result.answer;
  } catch (e: any) {
    return {
      results: new Map(),
      error: e?.message ?? "Snowflake connection error",
    };
  }

  // Robust JSON extraction — find the outermost { ... } even if model adds surrounding text
  const extractJson = (text: string): string | null => {
    // 1. Fenced code block
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) return fenced[1].trim();
    // 2. Find first { and last } — handles text before/after the JSON
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end > start) return text.slice(start, end + 1);
    return null;
  };

  const jsonStr = extractJson(raw);
  if (!jsonStr)
    return {
      results: new Map(),
      error:
        "Could not parse LLM response as JSON. Try rephrasing the question.",
    };

  try {
    const parsed: Record<string, string> = JSON.parse(jsonStr);

    function normalizeLabel(v: string): string {
      const u = v.toUpperCase().trim();
      if (u === "YES" || u === "NO" || u === "POSSIBLE" || u === "N/A")
        return u;
      if (u.startsWith("YES") || u === "TRUE" || u === "CONFIRMED")
        return "YES";
      if (
        u.startsWith("POSSIBLE") ||
        u === "PARTIAL" ||
        u === "MAYBE" ||
        u === "LIKELY"
      )
        return "POSSIBLE";
      if (
        u.startsWith("NO") ||
        u === "FALSE" ||
        u === "NONE" ||
        u === "NEGATIVE"
      )
        return "NO";
      return "N/A";
    }

    const canonicalNames = new Map(
      census.map((p) => [p.name.toLowerCase().trim(), p.name]),
    );
    const map = new Map<string, string>();
    for (const [name, label] of Object.entries(parsed)) {
      const keyLower = name.trim().toLowerCase();
      const canonical =
        canonicalNames.get(keyLower) ??
        [...canonicalNames.entries()].find(
          ([k]) => k.includes(keyLower) || keyLower.includes(k),
        )?.[1] ??
        name.trim();
      map.set(canonical, normalizeLabel(String(label)));
    }
    return { results: map };
  } catch {
    return {
      results: new Map(),
      error: "JSON parse error — try rephrasing the question.",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Quick-reply suggestions
// ─────────────────────────────────────────────────────────────────────────────

export function getSuggestions(selectedPatient: Patient | null): string[] {
  if (selectedPatient) {
    return [
      `What should I watch for with ${selectedPatient.diagnosis}?`,
      "Any medication interactions to be aware of?",
      "Help me write an SBAR for this patient",
      "When should I escalate?",
    ];
  }
  return [
    "Which patients have the highest risk right now?",
    "Show me patients with abnormal vitals",
    "Any patients on antibiotics with critical labs?",
    "Who should I check on first this shift?",
  ];
}
