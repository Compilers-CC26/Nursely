/**
 * Sync Orchestrator — Coordinates FHIR fetch → transform → Snowflake upsert
 *
 * This is the main pipeline called when a patient is selected.
 * It handles:
 *   1. Fetching FHIR Bundle
 *   2. Transforming to Snowflake rows
 *   3. Upserting into Snowflake
 *   4. Returning sync status + completeness flags
 */

import { fetchPatientBundle } from "./fhirClient";
import { transformBundle } from "./fhirTransformer";
import {
  upsertPatientSnapshot,
  callNurseQuery,
  isSnowflakeAvailable,
  type NurseQueryResult,
} from "./snowflakeClient";

export interface SyncResult {
  success: boolean;
  patientId: string;
  snapshotId: string | null;
  rowsWritten: number;
  completenessFlags: Record<string, any>;
  syncDurationMs: number;
  error?: string;
}

/**
 * Sync a patient: fetch FHIR → transform → upsert to Snowflake.
 */
export async function syncPatient(patientId: string): Promise<SyncResult> {
  const startTime = Date.now();
  console.log(`[Sync] Starting sync for patient ${patientId}`);

  try {
    // 1. Fetch FHIR Bundle
    const bundle = await fetchPatientBundle(patientId);
    console.log(
      `[Sync] Fetched ${bundle.entry.length} resources in ${Date.now() - startTime}ms`
    );

    // 2. Transform to flat rows
    const lookbackHours = Number(process.env.SYNC_LOOKBACK_HOURS ?? 72);
    const snapshot = transformBundle(patientId, bundle, lookbackHours);
    console.log(
      `[Sync] Transformed: ${snapshot.allergies.length} allergies, ` +
        `${snapshot.medications.length} meds, ${snapshot.labs.length} labs, ` +
        `${snapshot.vitals.length} vitals, ${snapshot.notes.length} notes`
    );

    // 3. Check Snowflake availability
    const sfAvailable = await isSnowflakeAvailable();
    if (!sfAvailable) {
      console.warn("[Sync] Snowflake not available — returning local snapshot only");
      return {
        success: true,
        patientId,
        snapshotId: null,
        rowsWritten: 0,
        completenessFlags: buildLocalFlags(snapshot),
        syncDurationMs: Date.now() - startTime,
        error: "Snowflake not configured — using local data only",
      };
    }

    // 4. Upsert into Snowflake
    const { rowsWritten, snapshotId } =
      await upsertPatientSnapshot(snapshot);

    const duration = Date.now() - startTime;
    console.log(
      `[Sync] Completed: ${rowsWritten} rows in ${duration}ms (snapshot: ${snapshotId})`
    );

    return {
      success: true,
      patientId,
      snapshotId,
      rowsWritten,
      completenessFlags: buildLocalFlags(snapshot),
      syncDurationMs: duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg =
      error instanceof Error ? error.message : "Unknown sync error";
    console.error(`[Sync] Failed after ${duration}ms:`, errorMsg);

    return {
      success: false,
      patientId,
      snapshotId: null,
      rowsWritten: 0,
      completenessFlags: {},
      syncDurationMs: duration,
      error: errorMsg,
    };
  }
}

/**
 * Ask a question about a patient through the Snowflake RAG pipeline.
 * Falls back to local mock if Snowflake is unavailable.
 */
export async function askQuestion(
  patientId: string,
  question: string,
  encounterId?: string
): Promise<NurseQueryResult> {
  const sfAvailable = await isSnowflakeAvailable();

  if (!sfAvailable) {
    console.warn(
      "[Sync] Snowflake not available — question will use mock service"
    );
    throw new Error("SNOWFLAKE_UNAVAILABLE");
  }

  return callNurseQuery(patientId, question, encounterId);
}

// ── Helpers ──

function buildLocalFlags(snapshot: any): Record<string, any> {
  const flags: Record<string, any> = {};

  if (snapshot.labs.length === 0) flags.missing_labs = true;
  if (snapshot.vitals.length === 0) flags.stale_vitals = true;
  if (snapshot.medications.length === 0) flags.no_medications = true;

  return flags;
}
