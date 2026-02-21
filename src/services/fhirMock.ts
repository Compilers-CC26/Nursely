/**
 * FHIR Mock Service
 *
 * Simulates FHIR-derived patient data access.
 * -----------------------------------------------
 * ⚠️  Replace mock with real FHIR fetch:
 *     Replace the static JSON import with calls to a FHIR R4 server, e.g.:
 *       GET /Patient, GET /Observation, GET /Condition
 *     Map FHIR resources to the Patient interface.
 * -----------------------------------------------
 */

import type { Patient } from "@/types";
import patientsData from "../../seed/patients.json";

const patients: Patient[] = patientsData as Patient[];

/** Return all patients */
export function listPatients(): Patient[] {
  return patients;
}

/**
 * Search patients by query string.
 * Matches against name, diagnosis, summary, and notes.
 */
export function searchPatients(query: string): Patient[] {
  if (!query.trim()) return patients;
  const q = query.toLowerCase();
  return patients.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.diagnosis.toLowerCase().includes(q) ||
      p.summary.toLowerCase().includes(q) ||
      p.mrn.toLowerCase().includes(q) ||
      p.notes.some((n) => n.toLowerCase().includes(q))
  );
}

/** Get a single patient by ID */
export function getPatient(id: string): Patient | undefined {
  return patients.find((p) => p.id === id);
}
