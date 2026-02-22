/**
 * Snowflake Service — Renderer-side analytics and query access
 *
 * Uses Electron IPC to call Snowflake when available,
 * falls back to local mock data in browser dev mode.
 */

import type { SnowflakeResult } from "@/types";

/** Check if running inside Electron with IPC available */
function hasElectronAPI(): boolean {
  return typeof window !== "undefined" && !!window.electronAPI?.snowflake;
}

// ── Mock data (fallback) ──

const MOCK_RESULT: SnowflakeResult = {
  cohortSummary: {
    topDiagnoses: [
      "Sepsis",
      "COPD Exacerbation",
      "Acute MI",
      "CHF Exacerbation",
      "Pneumonia",
      "DVT / PE",
    ],
    avgVitals: { hr: 94, bpSys: 130, bpDia: 76, temp: 99.8, spo2: 95 },
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
      options: [
        "2A",
        "2B",
        "2C",
        "2D",
        "3A",
        "3B",
        "3C",
        "3D",
        "4A",
        "4B",
        "4C",
        "4D",
        "5A",
        "5B",
        "5C",
        "5D",
        "6A",
        "6B",
        "6C",
        "6D",
        "7A",
        "7B",
        "7C",
        "7D",
      ],
    },
    {
      label: "Risk Category",
      options: [
        "Critical (>0.85)",
        "High (0.70–0.85)",
        "Moderate (0.50–0.70)",
        "Low (<0.50)",
      ],
    },
    {
      label: "Diagnosis Group",
      options: [
        "Cardiac",
        "Respiratory",
        "Infectious",
        "Neurological",
        "Surgical",
        "Other",
      ],
    },
  ],
};

/**
 * Get analytics results — tries Snowflake first, falls back to mock.
 */
export function getAnalyticsResults(): SnowflakeResult {
  // For now, always return mock synchronously for the Analyst panel
  // The async Snowflake version is used by the chat service
  return MOCK_RESULT;
}

/**
 * Ask a question via Snowflake RAG stored procedure.
 * Falls back to null if Snowflake is unavailable.
 */
export async function askSnowflakeQuestion(
  patientId: string,
  question: string,
  encounterId?: string,
): Promise<{
  answer: string;
  citations: Array<{ title: string; source: string; url: string }>;
  flags: string[];
  dataAsOf: string;
} | null> {
  if (!hasElectronAPI()) return null;

  try {
    const result = await window.electronAPI!.snowflake.query(
      patientId,
      question,
      encounterId,
    );
    if (result.success) {
      return {
        answer: result.answer ?? "",
        citations: result.citations ?? [],
        flags: result.flags ?? [],
        dataAsOf: result.dataAsOf ?? new Date().toISOString(),
      };
    }
    return null;
  } catch {
    return null;
  }
}
