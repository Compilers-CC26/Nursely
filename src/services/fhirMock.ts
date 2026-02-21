/**
 * FHIR Service — Renderer-side patient data access
 *
 * Uses Electron IPC when available (sync-on-select from live FHIR),
 * falls back to local seed data in browser dev mode.
 */

import type { Patient } from "@/types";
import patientsData from "../../seed/patients.json";

const localPatients: Patient[] = patientsData as Patient[];

/** Check if running inside Electron with IPC available */
function hasElectronAPI(): boolean {
  return typeof window !== "undefined" && !!window.electronAPI?.fhir;
}

/** Return all patients (local seed for table, always available) */
export function listPatients(): Patient[] {
  return localPatients;
}

/**
 * Search patients by query string.
 * Always uses local seed data for fast filtering.
 */
export function searchPatients(query: string): Patient[] {
  if (!query.trim()) return localPatients;
  const q = query.toLowerCase();
  return localPatients.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.diagnosis.toLowerCase().includes(q) ||
      p.summary.toLowerCase().includes(q) ||
      p.mrn.toLowerCase().includes(q) ||
      p.notes.some((n) => n.toLowerCase().includes(q))
  );
}

/** Get a single patient by ID (local) */
export function getPatient(id: string): Patient | undefined {
  return localPatients.find((p) => p.id === id);
}

/**
 * Sync a patient to Snowflake via Electron IPC.
 * Fetches FHIR Bundle → transforms → upserts.
 * Returns sync result or null if not in Electron.
 */
export async function syncPatientToSnowflake(
  patientId: string
): Promise<{
  success: boolean;
  rowsWritten: number;
  syncDurationMs: number;
  error?: string;
} | null> {
  if (!hasElectronAPI()) return null;

  try {
    const result = await window.electronAPI!.snowflake.syncPatient(patientId);
    return result;
  } catch (err) {
    console.warn("[FHIR Service] Sync failed:", err);
    return { success: false, rowsWritten: 0, syncDurationMs: 0, error: String(err) };
  }
}

/**
 * Check Snowflake connection status.
 */
export async function getSnowflakeStatus(): Promise<{
  available: boolean;
  reason?: string;
}> {
  if (!hasElectronAPI()) {
    return { available: false, reason: "Not running in Electron" };
  }

  try {
    return await window.electronAPI!.snowflake.getStatus();
  } catch {
    return { available: false, reason: "IPC error" };
  }
}
