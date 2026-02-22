/**
 * Chat Mock Service
 *
 * Simulates an agentic AI assistant for nurses.
 * -----------------------------------------------
 * ⚠️  Replace chatMock with real LLM API call:
 *     Swap generateResponse() with a call to OpenAI, Anthropic,
 *     or your internal clinical LLM endpoint. Pass the patient
 *     context and conversation history for contextual answers.
 *     Real citations should come from RAG retrieval or tool-use.
 * -----------------------------------------------
 */

import type { Patient } from "@/types";
import { askSnowflakeQuestion } from "@/services/snowflakeMock";

export interface Citation {
  /** Short label shown on the chip, e.g. "CMS SEP-1 Bundle" */
  title: string;
  /** Source organization or guideline name */
  source: string;
  /** URL (or internal doc link) — set to "#" for mock */
  url: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  timestamp: Date;
}

interface TopicResponse {
  content: string;
  citations: Citation[];
}

const CLINICAL_RESPONSES: Record<string, TopicResponse[]> = {
  sepsis: [
    {
      content:
        "**Sepsis Bundle (SEP-1) Key Steps:**\n1. Measure lactate level\n2. Obtain blood cultures before antibiotics\n3. Administer broad-spectrum antibiotics within 1 hour\n4. Administer 30 mL/kg crystalloid for hypotension or lactate ≥ 4\n5. Apply vasopressors if hypotensive after fluid resuscitation\n6. Remeasure lactate if initial lactate > 2 mmol/L\n\nFor this patient, verify all bundle elements are documented in the EHR.",
      citations: [
        {
          title: "SEP-1 Early Management Bundle",
          source: "CMS / The Joint Commission",
          url: "https://www.jointcommission.org/measurement/measures/sepsis/",
        },
        {
          title: "Surviving Sepsis Campaign 2021",
          source: "Society of Critical Care Medicine",
          url: "https://www.sccm.org/SurvivingSepsisCampaign/Guidelines",
        },
        {
          title: "Sepsis Core Measure",
          source: "CMS Quality Measures",
          url: "https://qualitynet.cms.gov/inpatient/measures/sep",
        },
      ],
    },
  ],
  medication: [
    {
      content:
        "I can help with medication questions. Here are common nursing considerations:\n\n• **Before administering**: Verify the 5 Rights (right patient, drug, dose, route, time)\n• **High-alert meds**: Double-check insulin, heparin, opioids, and vasoactive drips\n• **Drug interactions**: Always cross-reference with current med list in the MAR\n• **PRN documentation**: Document indication, assessment before/after\n\nWhat specific medication do you need information about?",
      citations: [
        {
          title: "High-Alert Medications in Acute Care",
          source: "ISMP (Institute for Safe Medication Practices)",
          url: "https://www.ismp.org/recommendations/high-alert-medications-acute-list",
        },
        {
          title: "Medication Administration Safety",
          source: "ANA (American Nurses Association)",
          url: "https://www.nursingworld.org/practice-policy/nursing-excellence/official-position-statements/",
        },
      ],
    },
  ],
  vitals: [
    {
      content:
        "**Quick Vitals Reference — When to Escalate:**\n\n| Parameter | Concern Range |\n|-----------|---------------|\n| HR | < 50 or > 120 |\n| SBP | < 90 or > 180 |\n| RR | < 10 or > 28 |\n| Temp | > 101.3°F or < 96°F |\n| SpO2 | < 92% on room air |\n\nIf 2+ parameters are abnormal, consider activating the **Rapid Response Team**. Always trend vitals — a single reading matters less than the trajectory.",
      citations: [
        {
          title: "Modified Early Warning Score (MEWS)",
          source: "BMJ Best Practice",
          url: "https://bestpractice.bmj.com/topics/en-us/1207",
        },
        {
          title: "National Early Warning Score (NEWS2)",
          source: "Royal College of Physicians",
          url: "https://www.rcplondon.ac.uk/projects/outputs/national-early-warning-score-news-2",
        },
        {
          title: "Rapid Response Systems",
          source: "Agency for Healthcare Research and Quality (AHRQ)",
          url: "https://www.ahrq.gov/patient-safety/settings/hospital/rrr/index.html",
        },
      ],
    },
  ],
  labs: [
    {
      content:
        "**Common Critical Lab Values to Report Immediately:**\n\n• Potassium: < 3.0 or > 6.0 mEq/L\n• Sodium: < 120 or > 160 mEq/L\n• Glucose: < 50 or > 500 mg/dL\n• Troponin: Any elevation above normal\n• Lactate: > 2.0 mmol/L\n• Hemoglobin: < 7.0 g/dL\n• INR: > 4.0 (or any critical value per your lab)\n\nAlways call the provider for critical values and document the time of notification.",
      citations: [
        {
          title: "Critical / Panic Lab Values",
          source: "CLSI (Clinical and Laboratory Standards Institute)",
          url: "https://clsi.org/",
        },
        {
          title: "Laboratory Critical Values",
          source: "College of American Pathologists (CAP)",
          url: "https://www.cap.org/",
        },
      ],
    },
  ],
  fall: [
    {
      content:
        "**Fall Prevention Protocol:**\n\n1. Assess fall risk using Morse Fall Scale on admission and every shift\n2. For high-risk patients:\n   - Yellow wristband and door sign\n   - Bed in lowest position, wheels locked\n   - Call light within reach\n   - Non-skid footwear\n   - Toileting schedule every 2 hours\n   - Consider 1:1 sitter or bed alarm\n3. Educate patient and family on fall prevention\n4. Document all interventions in the care plan",
      citations: [
        {
          title: "Morse Fall Scale",
          source: "Journal of Nursing Administration (1989)",
          url: "https://pubmed.ncbi.nlm.nih.gov/2787768/",
        },
        {
          title: "Preventing Falls in Hospitals",
          source: "AHRQ Patient Safety Network",
          url: "https://www.ahrq.gov/patient-safety/settings/hospital/fall-prevention/toolkit/index.html",
        },
        {
          title: "Fall Prevention Guidelines",
          source: "The Joint Commission",
          url: "https://www.jointcommission.org/resources/patient-safety-topics/falls/",
        },
      ],
    },
  ],
  pain: [
    {
      content:
        "**Pain Assessment & Management:**\n\n• Use appropriate scale: NRS (0-10) for verbal patients, FLACC or CPOT for non-verbal\n• Assess pain with every vital sign check\n• Document: Location, quality, intensity, duration, aggravating/alleviating factors\n• Non-pharmacologic options first when appropriate: repositioning, ice/heat, distraction, relaxation\n• For PRN meds: reassess 30 min after IV, 60 min after PO\n• Set realistic pain goals with the patient\n\nWhat specific pain concern do you have?",
      citations: [
        {
          title: "Pain Management Nursing Standards",
          source: "American Society for Pain Management Nursing (ASPMN)",
          url: "https://www.aspmn.org/",
        },
        {
          title: "CPOT: Critical-Care Pain Observation Tool",
          source: "American Journal of Critical Care (2006)",
          url: "https://pubmed.ncbi.nlm.nih.gov/16823021/",
        },
        {
          title: "WHO Analgesic Ladder",
          source: "World Health Organization",
          url: "https://www.who.int/cancer/palliative/painladder/en/",
        },
      ],
    },
  ],
  sbar: [
    {
      content:
        "**SBAR Communication Framework:**\n\n**S — Situation**: State who you are, which patient, and what's happening right now\n**B — Background**: Relevant history, admission diagnosis, pertinent recent events\n**A — Assessment**: Your clinical impression — what you think is going on\n**R — Recommendation**: What you need from the provider — specific orders or actions\n\n💡 **Tip**: Write your SBAR before calling. Lead with urgency level. Have the chart open during the call.\n\nI can generate an SBAR for any selected patient — just click one in the table.",
      citations: [
        {
          title: "SBAR Communication Technique",
          source: "Institute for Healthcare Improvement (IHI)",
          url: "https://www.ihi.org/resources/Pages/Tools/SBARToolkit.aspx",
        },
        {
          title: "TeamSTEPPS Communication",
          source: "AHRQ",
          url: "https://www.ahrq.gov/teamstepps/index.html",
        },
      ],
    },
  ],
  code: [
    {
      content:
        "**Code Blue Response Checklist:**\n\n1. Call code / activate emergency response\n2. Begin high-quality CPR (push hard, push fast, 100-120/min)\n3. Attach AED/defibrillator as soon as available\n4. Establish IV access\n5. Administer epinephrine 1mg IV q3-5min\n6. Identify and treat reversible causes (H's and T's)\n7. Document — assign a recorder role\n\n**H's**: Hypovolemia, Hypoxia, H+ (acidosis), Hypo/Hyperkalemia, Hypothermia\n**T's**: Tension pneumothorax, Tamponade, Toxins, Thrombosis (PE/MI)",
      citations: [
        {
          title: "ACLS Guidelines 2020",
          source: "American Heart Association (AHA)",
          url: "https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines",
        },
        {
          title: "BLS/ACLS Algorithm Cards",
          source: "AHA",
          url: "https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines/algorithms",
        },
      ],
    },
  ],
};

const PATIENT_CONTEXT_RESPONSES: TopicResponse[] = [
  {
    content:
      "Based on this patient's current presentation, here are my recommendations:\n\n1. **Priority assessments**: Focus on trending vitals every 1-2 hours given the acuity\n2. **Lab monitoring**: Flag any critical values for immediate provider notification\n3. **Documentation**: Ensure all interventions and assessments are charted in real-time\n4. **Care coordination**: Consider rounding with the interdisciplinary team\n\nWould you like me to go deeper into any of these areas?",
    citations: [
      {
        title: "Patient EHR Record",
        source: "Local FHIR Data",
        url: "#patient-ehr",
      },
      {
        title: "Clinical Decision Support",
        source: "Snowflake Analytics",
        url: "#snowflake-analytics",
      },
      {
        title: "Nursing Assessment Standards",
        source: "ANA Scope & Standards of Practice",
        url: "https://www.nursingworld.org/practice-policy/scope-of-practice/",
      },
    ],
  },
  {
    content:
      "Looking at the patient's clinical picture:\n\n• Current medications appear appropriate for the diagnosis\n• Watch for potential drug interactions — review the MAR carefully\n• Ensure PRN medications have clear parameters documented\n• Verify all ordered labs are drawn on schedule\n\nIs there a specific aspect of this patient's care you'd like guidance on?",
    citations: [
      {
        title: "Patient EHR Record",
        source: "Local FHIR Data",
        url: "#patient-ehr",
      },
      {
        title: "Drug Interaction Checker",
        source: "Lexicomp / UpToDate",
        url: "https://www.uptodate.com/drug-interactions/",
      },
    ],
  },
];

const GENERAL_RESPONSES: TopicResponse[] = [
  {
    content:
      "I'm here to help with clinical questions, care protocols, medication guidance, and documentation support. Here are some things I can assist with:\n\n• **Patient assessments** — vitals interpretation, lab values, clinical changes\n• **Protocols** — sepsis bundles, fall prevention, pain management, code response\n• **Medications** — drug information, interactions, administration guidelines\n• **Documentation** — SBAR reports, nursing notes, care plan updates\n• **Escalation** — when and how to notify providers or rapid response\n\nJust ask your question and I'll provide evidence-based guidance!",
    citations: [],
  },
  {
    content:
      "That's a great question. Let me help you think through this:\n\n1. Start by reviewing the patient's most recent assessment\n2. Check for any new orders or changes in the plan of care\n3. Verify that all interventions are documented\n4. Consider if any notifications to the provider are needed\n\nCan you give me more details about what specific information you need?",
    citations: [
      {
        title: "Nursing Process Framework",
        source: "ANA (American Nurses Association)",
        url: "https://www.nursingworld.org/practice-policy/workforce/what-is-nursing/the-nursing-process/",
      },
    ],
  },
];

function matchTopic(message: string): string | null {
  const lower = message.toLowerCase();
  const topics: [string, string[]][] = [
    ["sepsis", ["sepsis", "septic", "infection", "lactate", "bundle"]],
    [
      "medication",
      [
        "medication",
        "medicine",
        "drug",
        "med",
        "dose",
        "dosage",
        "administer",
        "give",
      ],
    ],
    [
      "vitals",
      [
        "vital",
        "blood pressure",
        "heart rate",
        "temperature",
        "oxygen",
        "spo2",
        "bp",
        "hr",
        "temp",
      ],
    ],
    [
      "labs",
      [
        "lab",
        "blood work",
        "cbc",
        "bmp",
        "troponin",
        "potassium",
        "sodium",
        "glucose",
        "hemoglobin",
        "critical value",
      ],
    ],
    ["fall", ["fall", "falling", "slip", "balance", "morse", "bed alarm"]],
    [
      "pain",
      ["pain", "hurt", "discomfort", "analgesic", "opioid", "narcotic", "prn"],
    ],
    [
      "sbar",
      ["sbar", "handoff", "report", "communicate", "situation background"],
    ],
    [
      "code",
      ["code blue", "code", "arrest", "cpr", "resuscitation", "emergency"],
    ],
  ];

  for (const [topic, keywords] of topics) {
    if (keywords.some((kw) => lower.includes(kw))) return topic;
  }
  return null;
}

let msgCounter = 0;

export interface ChatResponse {
  content: string;
  citations: Citation[];
}

/**
 * Extract the best available diagnosis label for a patient.
 * Falls back to the first condition name in summary when the diagnosis
 * field is null/Unknown (common when loading from old Snowflake data).
 */
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

  // Try to parse first condition from summary: "Active conditions: Cond1; Cond2..."
  if (p.summary) {
    const match = p.summary.match(/Active conditions:\s*([^;\n]+)/i);
    if (match) {
      const extracted = match[1].trim();
      if (
        extracted &&
        !bad.has(extracted.toLowerCase()) &&
        extracted !== "Unknown condition"
      ) {
        return extracted;
      }
    }
  }
  return null;
}

/**
 * Generate a mock response based on the user message and optional patient context.
 * Returns content + citations for source attribution.
 */
export async function generateResponse(
  message: string,
  _selectedPatient: Patient | null,
  _conversationHistory: ChatMessage[],
  _liveCensus: Patient[] = [],
): Promise<ChatResponse> {
  const lower = message.toLowerCase();

  // Detect Global Intent: cohort-level or comparison questions
  const COHORT_KEYWORDS = [
    "unit",
    "floor",
    "everyone",
    "census",
    "all patients",
    "rank",
    "ranking",
    "ranked",
    "compared to",
    "compare to",
    "other patients",
    "rest of",
    "relative to",
    "versus",
    " vs ",
    "across the",
    "on the unit",
    // Population / listing queries
    "top ",
    "who are",
    "who is the",
    "which patients",
    "which patient",
    "our patients",
    "our top",
    "list ",
    "highest risk",
    "most critical",
    "most urgent",
    "sickest",
    "any patients",
    "how many patients",
  ];
  const isGlobalIntent =
    !_selectedPatient || COHORT_KEYWORDS.some((kw) => lower.includes(kw));

  // ── Build live frontend context to inject into every LLM call ──
  // Snowflake tables are often stale or empty; the frontend data is always current.
  // We prepend it so the LLM always has the real values regardless of what's in SF.
  function buildLivePatientContext(p: Patient): string {
    const v = p.vitals;
    const fmt = (val: number | null, unit: string) =>
      val !== null ? `${val} ${unit}` : "N/A";
    const vitalsLine = v
      ? `HR=${fmt(v.hr, "bpm")}, BP=${v.bpSys !== null && v.bpDia !== null ? `${v.bpSys}/${v.bpDia} mmHg` : "N/A"}, Temp=${fmt(v.temp, "°F")}, SpO2=${fmt(v.spo2, "%")}, RR=${fmt(v.rr, "/min")}${v.timestamp ? ` (recorded ${new Date(v.timestamp).toLocaleString()})` : ""}`
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
    const medsLine = p.meds.length > 0 ? p.meds.join(", ") : "None documented";
    const allergiesLine =
      p.allergies.length > 0 ? p.allergies.join(", ") : "NKDA";
    return [
      `PATIENT: ${p.name}, ${p.age}yo ${p.sex}, Room ${p.room}, MRN ${p.mrn}`,
      `DIAGNOSIS: ${p.diagnosis || "No active conditions"}`,
      `VITALS: ${vitalsLine}`,
      `LABS: ${labLines}`,
      `MEDICATIONS: ${medsLine}`,
      `ALLERGIES: ${allergiesLine}`,
    ].join("\n");
  }

  // ── Try Snowflake RAG ──
  try {
    if (isGlobalIntent) {
      const enrichedMessage = _selectedPatient
        ? `Regarding patient ${_selectedPatient.name} (Diagnosis: ${_selectedPatient.diagnosis}, Risk Score: ${_selectedPatient.riskScore.toFixed(2)}): ${message}`
        : message;
      const gResult = await askSnowflakeCohortQuestion(enrichedMessage);
      if (gResult) return gResult;
    } else if (_selectedPatient) {
      // Inject live frontend data into the question so Cortex always has current values
      const liveContext = buildLivePatientContext(_selectedPatient);
      const enrichedQuestion = `[LIVE EHR DATA — use this as the authoritative source for vitals, labs, and medications]\n${liveContext}\n\nNURSE QUESTION: ${message}`;
      const sfResult = await askSnowflakeQuestion(
        _selectedPatient.id,
        enrichedQuestion,
      );
      if (sfResult) {
        return {
          content: sfResult.answer,
          citations: sfResult.citations.map((c) => ({
            title: c.title,
            source: c.source,
            url: c.url,
          })),
        };
      }
    }
  } catch {
    // Snowflake unavailable — fall through to mock
  }

  // ── Fallback: local mock responses ──
  // Simulate network / LLM latency
  // ── Fallback: Snowflake was unreachable — build a data-grounded response locally ──
  // Only reached when the LLM is completely unavailable. Uses live frontend data, not canned strings.
  await new Promise((resolve) =>
    setTimeout(resolve, 400 + Math.random() * 400),
  );

  // For cohort/global questions, compute answers from the live census
  if (isGlobalIntent && _liveCensus.length > 0) {
    const cohortSorted = [..._liveCensus].sort(
      (a, b) => b.riskScore - a.riskScore,
    );
    const dxCount: Record<string, number> = {};
    for (const p of _liveCensus) {
      const dx = getEffectiveDiagnosis(p);
      if (dx) dxCount[dx] = (dxCount[dx] || 0) + 1;
    }
    const sortedDx = Object.entries(dxCount).sort((a, b) => b[1] - a[1]);
    const highRisk = cohortSorted.filter((p) => p.riskScore > 0.8).length;
    const total = _liveCensus.length;
    const unitAvg = (
      cohortSorted.reduce((s, p) => s + p.riskScore, 0) / total
    ).toFixed(2);
    const topDx =
      sortedDx
        .slice(0, 3)
        .map(([dx]) => dx)
        .join(", ") || "unavailable";

    // Ranking query with a patient selected
    if (_selectedPatient) {
      const rank =
        cohortSorted.findIndex((p) => p.id === _selectedPatient!.id) + 1;
      const topAbove = cohortSorted.filter(
        (p) => p.riskScore > _selectedPatient!.riskScore,
      ).length;
      return {
        content:
          `**${_selectedPatient.name}** has a risk score of **${_selectedPatient.riskScore.toFixed(2)}**, ranking **#${rank} of ${total}** on the unit.\n` +
          `${topAbove} patient${topAbove !== 1 ? "s have" : " has"} a higher score. Unit average: ${unitAvg}.\n` +
          (highRisk > 0
            ? `\n${highRisk} patient${highRisk !== 1 ? "s are" : " is"} high-risk (score > 0.80).`
            : "") +
          `\n\n*Note: AI assistant temporarily unavailable — data sourced directly from live census.*`,
        citations: [
          { title: "Live Census Analytics", source: "Live Census", url: "#" },
        ],
      };
    }

    // General cohort question
    const withAbnormal = _liveCensus.filter((p) =>
      p.labs.some((l) => l.flag !== "normal"),
    ).length;
    return {
      content:
        `**Unit Census — ${total} patients** *(AI offline — live data only)*\n\n` +
        `• High-risk (score > 0.80): **${highRisk}**\n` +
        `• Average risk score: **${unitAvg}**\n` +
        `• Patients with abnormal labs: **${withAbnormal}**\n` +
        `• Top diagnoses: ${topDx}\n` +
        (cohortSorted[0]
          ? `• Highest risk: **${cohortSorted[0].name}** (${cohortSorted[0].riskScore.toFixed(2)})\n`
          : ""),
      citations: [
        { title: "Live Census Analytics", source: "Live Census", url: "#" },
      ],
    };
  }

  // For single-patient questions, use the live frontend data directly
  if (_selectedPatient) {
    const liveContext = buildLivePatientContext(_selectedPatient);
    return {
      content:
        `*AI assistant temporarily unavailable. Here is the current data on file for ${_selectedPatient.name}:*\n\n` +
        liveContext
          .split("\n")
          .map((line) => `• ${line}`)
          .join("\n"),
      citations: [
        { title: "EHR Record", source: "Live Patient Data", url: "#" },
      ],
    };
  }

  return {
    content: `AI assistant is temporarily unavailable. Please try again shortly or consult the EHR directly.`,
    citations: [],
  };
}

/** Helper to generate dynamic, patient-aware responses based on actual passed data */
function generateDynamicResponse(
  intent: "vitals" | "meds" | "recs",
  patient: Patient,
): TopicResponse {
  if (intent === "vitals") {
    let vitalsSummary = "**Recent Vitals Trends:**\n\n";
    if (patient.vitals) {
      vitalsSummary += `• **Heart Rate:** ${patient.vitals.hr || "--"} bpm\n`;
      vitalsSummary += `• **Blood Pressure:** ${patient.vitals.bpSys || "--"}/${patient.vitals.bpDia || "--"} mmHg\n`;
      vitalsSummary += `• **Resp Rate:** ${patient.vitals.rr || "--"} breaths/min\n`;
      vitalsSummary += `• **Temperature:** ${patient.vitals.temp || "--"} °F\n`;
      vitalsSummary += `• **SpO2:** ${patient.vitals.spo2 || "--"}%\n\n`;

      const alerts = [];
      if (
        patient.vitals.hr &&
        (patient.vitals.hr > 100 || patient.vitals.hr < 60)
      )
        alerts.push("Abnormal Heart Rate");
      if (
        patient.vitals.bpSys &&
        (patient.vitals.bpSys > 140 || patient.vitals.bpSys < 90)
      )
        alerts.push("Abnormal Blood Pressure");
      if (patient.vitals.spo2 && patient.vitals.spo2 < 92)
        alerts.push("Low Oxygen Saturation");
      if (patient.vitals.temp && patient.vitals.temp > 100.4)
        alerts.push("Elevated Temperature");

      if (alerts.length > 0) {
        vitalsSummary += `🚨 **Alerts detected:** ${alerts.join(", ")}. Recommend continuous telemetry monitoring and provider notification if persistent.`;
      } else {
        vitalsSummary +=
          "✅ Vitals appear stable and within typical ranges. Recommend routine monitoring per unit protocol.";
      }
    } else {
      vitalsSummary = "No recent vitals available for this patient.";
    }

    return {
      content: vitalsSummary,
      citations: [
        {
          title: "Patient Vitals Flowsheet",
          source: "Local EHR Data",
          url: "#",
        },
      ],
    };
  }

  if (intent === "meds") {
    let medsSummary = "**Medication Review:**\n\n";
    if (patient.meds && patient.meds.length > 0) {
      medsSummary += `Patient is currently on **${patient.meds.length} active medications**.\n\n`;
      const highAlertKeywords = [
        "insulin",
        "heparin",
        "warfarin",
        "morphine",
        "oxycodone",
        "fentanyl",
        "propofol",
        "amiodarone",
      ];
      const foundHighAlert = patient.meds.filter((m) =>
        highAlertKeywords.some((k) => m.toLowerCase().includes(k)),
      );

      if (foundHighAlert.length > 0) {
        medsSummary += `🚨 **High-Alert Medications Found:**\n`;
        foundHighAlert.forEach((m) => {
          medsSummary += `• ${m}\n`;
        });
        medsSummary += `\n*Action:* Double-check dosage and parameters before administration. Ensure independent double-verification if required by policy.\n`;
      } else {
        medsSummary += `✅ No standard high-alert medications match in the current list. Always perform the 5 Rights of Medication Administration.\n`;
      }
    } else {
      medsSummary = "No active medications found in the current record.";
    }

    return {
      content: medsSummary,
      citations: [
        { title: "Current MAR", source: "Local EHR Data", url: "#" },
        {
          title: "High-Alert Medications",
          source: "ISMP",
          url: "https://www.ismp.org/recommendations/high-alert-medications-acute-list",
        },
      ],
    };
  }

  if (intent === "recs") {
    let recs = `**Nursing Care Recommendations for ${patient.name}**\n\n`;
    recs += `**Primary Diagnosis:** ${patient.diagnosis}\n\n`;
    recs += "**Priority Interventions:**\n";
    recs +=
      "1. **Assess:** Perform comprehensive primary assessment focusing on symptomatic relief.\n";
    recs +=
      "2. **Monitor:** Trending vitals q4h and escalating parameters outside baseline.\n";

    const abnormalLabs = patient.labs.filter((l) => l.flag !== "normal");
    if (abnormalLabs.length > 0) {
      recs += `3. **Lab Follow-Up:** Monitor specifically for changes in: **${abnormalLabs.map((l) => l.name).join(", ")}** as these are currently flagged abnormal.\n`;
    } else {
      recs +=
        "3. **Lab Follow-Up:** Routine morning draws. No critical values currently flagged.\n";
    }

    recs +=
      "4. **Education:** Review care plan and discharge criteria with patient/family.\n\n";
    recs +=
      "*Note: Recommendations generated dynamically. Always rely on clinical judgment and standing orders.*";

    return {
      content: recs,
      citations: [
        {
          title: "Clinical Care Pathways",
          source: "Hospital Policies",
          url: "#",
        },
      ],
    };
  }

  return GENERAL_RESPONSES[0];
}

/** Quick-reply suggestions to get nurses started */
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
    "What's the sepsis bundle protocol?",
    "When should I call a rapid response?",
    "Help me interpret critical lab values",
    "Fall prevention best practices",
  ];
}

/**
 * Ask a cohort-level question via Snowflake without a specific patientId.
 */
async function askSnowflakeCohortQuestion(
  question: string,
): Promise<ChatResponse | null> {
  if (typeof window === "undefined" || !window.electronAPI?.snowflake)
    return null;

  try {
    const result = await window.electronAPI!.snowflake.query(
      undefined,
      question,
    );
    if (result.success) {
      return {
        content: result.answer,
        citations: result.citations || [],
      };
    }
    return null;
  } catch {
    return null;
  }
}
