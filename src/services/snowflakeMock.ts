/**
 * Snowflake Mock Service
 *
 * Simulates analytics results from a Snowflake warehouse.
 * -----------------------------------------------
 * ⚠️  Replace snowflakeMock with API call:
 *     Replace these static returns with authenticated REST calls to
 *     your Snowflake SQL API endpoint (POST /api/v2/statements).
 *     Use real credentials and warehouse/database/schema config.
 * -----------------------------------------------
 */

import type { SnowflakeResult } from "@/types";

/**
 * Returns a mocked cohort summary, suggested queries, and filters
 * as if returned by a Snowflake analytics query.
 */
export function getAnalyticsResults(): SnowflakeResult {
  return {
    cohortSummary: {
      topDiagnoses: [
        "Sepsis",
        "COPD Exacerbation",
        "Acute MI",
        "CHF Exacerbation",
        "Pneumonia",
        "DVT / PE",
      ],
      avgVitals: {
        hr: 94,
        bpSys: 130,
        bpDia: 76,
        temp: 99.8,
        spo2: 95,
      },
      alerts: [
        "12 patients with Risk Score > 0.80",
        "5 patients with critical lab values",
        "3 patients pending ICU transfer",
        "Sepsis bundle compliance: 78%",
      ],
    },
    suggestedQueries: [
      "Patients with lactate > 2.0 and fever",
      "Readmission risk within 30 days",
      "Patients due for antibiotic reassessment at 48h",
      "High fall-risk patients not on precautions",
    ],
    suggestedFilters: [
      {
        label: "Unit / Floor",
        options: ["2A", "2B", "2C", "2D", "3A", "3B", "3C", "3D", "4A", "4B", "4C", "4D", "5A", "5B", "5C", "5D", "6A", "6B", "6C", "6D", "7A", "7B", "7C", "7D"],
      },
      {
        label: "Risk Category",
        options: ["Critical (>0.85)", "High (0.70–0.85)", "Moderate (0.50–0.70)", "Low (<0.50)"],
      },
      {
        label: "Diagnosis Group",
        options: ["Cardiac", "Respiratory", "Infectious", "Neurological", "Surgical", "Other"],
      },
    ],
  };
}

/**
 * Generate SBAR (Situation, Background, Assessment, Recommendation)
 * for a given patient. In production, this would call an LLM or
 * Snowflake Cortex function.
 */
export function generateSBAR(patient: {
  name: string;
  age: number;
  sex: string;
  room: string;
  diagnosis: string;
  summary: string;
  vitals: { hr: number; bpSys: number; bpDia: number; rr: number; temp: number; spo2: number };
  labs: { name: string; value: string; unit: string; flag: string }[];
  meds: string[];
  allergies: string[];
  notes: string[];
  riskScore: number;
}): { situation: string; background: string; assessment: string; recommendation: string } {
  const abnormalLabs = patient.labs
    .filter((l) => l.flag !== "normal")
    .map((l) => `${l.name}: ${l.value} ${l.unit} (${l.flag})`)
    .join("; ");

  return {
    situation: `${patient.name}, ${patient.age}yo ${patient.sex}, Room ${patient.room}. Admitted for ${patient.diagnosis}. ${patient.summary}`,
    background: `Primary diagnosis: ${patient.diagnosis}. Current medications: ${patient.meds.join(", ") || "None"}. Allergies: ${patient.allergies.length > 0 ? patient.allergies.join(", ") : "NKDA"}. ${patient.notes.length > 0 ? "Recent notes: " + patient.notes[0] : ""}`,
    assessment: `Vitals — HR: ${patient.vitals.hr}, BP: ${patient.vitals.bpSys}/${patient.vitals.bpDia}, RR: ${patient.vitals.rr}, Temp: ${patient.vitals.temp}°F, SpO2: ${patient.vitals.spo2}%. ${abnormalLabs ? "Abnormal labs: " + abnormalLabs + "." : "Labs within normal limits."} Risk Score: ${patient.riskScore.toFixed(2)}.`,
    recommendation: `Continue current treatment plan. Reassess vitals in 2 hours. ${patient.riskScore > 0.8 ? "⚠️ High risk — consider escalation to rapid response or ICU consult." : "Monitor closely and reassess at next rounding."} Communicate findings to attending physician. Update care plan as needed.`,
  };
}
