/**
 * FHIR Service — Renderer-side IPC wrapper
 *
 * Uses Electron IPC when available to fetch live dynamic census
 * and sync individual patients to Snowflake. Local static seed
 * data has been removed in favor of the dynamic BFF approach.
 */

import type { Patient } from "@/types";

/** Check if running inside Electron with IPC available */
function hasElectronAPI(): boolean {
  return typeof window !== "undefined" && !!window.electronAPI?.fhir;
}

/** Return empty array for browser dev mode fallback */
export function listPatients(): Patient[] {
  return [];
}

/** Return empty array for browser dev mode fallback */
export function searchPatients(query: string): Patient[] {
  return [];
}

/**
 * Fetch a single detailed patient record (vitals, labs, etc) from the BFF.
 */
export async function getPatientDetail(patientId: string): Promise<Patient | null> {
  if (!hasElectronAPI()) return null;

  try {
    const result = await window.electronAPI!.fhir.getPatient(patientId);
    if (result.success) return result.patient;
    return null;
  } catch (err) {
    console.warn("[FHIR Service] Failed to get patient details:", err);
    return null;
  }
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
