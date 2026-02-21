/**
 * Patient data types — derived from Synthea FHIR fields.
 * Replace these with real FHIR resource types when integrating.
 */

export interface Vitals {
  hr: number;
  bpSys: number;
  bpDia: number;
  rr: number;
  temp: number;
  spo2: number;
  timestamp: string;
}

export interface Lab {
  name: string;
  value: string;
  unit: string;
  flag: "normal" | "high" | "low" | "critical";
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  sex: "M" | "F";
  room: string;
  mrn: string;
  diagnosis: string;
  summary: string;
  vitals: Vitals;
  labs: Lab[];
  meds: string[];
  allergies: string[];
  notes: string[];
  riskScore: number;
}

export interface CohortSummary {
  topDiagnoses: string[];
  avgVitals: {
    hr: number;
    bpSys: number;
    bpDia: number;
    temp: number;
    spo2: number;
  };
  alerts: string[];
}

export interface SnowflakeResult {
  cohortSummary: CohortSummary;
  suggestedQueries: string[];
  suggestedFilters: { label: string; options: string[] }[];
}
