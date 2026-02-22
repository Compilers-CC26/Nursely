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

import { fetchPatientBundle, fetchPatientMetadata } from "./fhirClient";
import { transformBundle } from "./fhirTransformer";
import {
  upsertPatientSnapshot,
  callNurseQuery,
  callCohortQuery,
  isSnowflakeAvailable,
  isPatientSyncedRecent,
  getPatientSyncMetadata,
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
 * includes a staleness check to skip redundant fetches.
 */
export async function syncPatient(patientId: string): Promise<SyncResult> {
  const startTime = Date.now();

  // 1. Intelligent Staleness Check: Check if Snowflake is available and data is truly fresh
  const sfAvailable = await isSnowflakeAvailable();
  let needsSync = true;

  if (sfAvailable) {
    // A. Check if synced within the last few minutes (avoid hitting FHIR excessively)
    const isRecent = await isPatientSyncedRecent(patientId, 5); // 5 min "safety" lock
    if (isRecent) {
      // B. Even if recent, check if metadata has changed (Event-based intelligence)
      const liveMetadata = await fetchPatientMetadata(patientId);
      const dbMetadata = await getPatientSyncMetadata(patientId);

      const liveLastUpdated = liveMetadata?.meta?.lastUpdated;
      const dbLastUpdated = dbMetadata?.fhirLastUpdated;

      if (liveLastUpdated === dbLastUpdated && dbLastUpdated !== null) {
        console.log(
          `[Sync] Patient ${patientId} data is up to date (LastUpdated: ${dbLastUpdated}). Skipping fetch.`,
        );
        needsSync = false;
      } else {
        console.log(
          `[Sync] Data changed on server (FHIR: ${liveLastUpdated}, DB: ${dbLastUpdated}). Forcing refresh.`,
        );
      }
    }
  }

  if (!needsSync) {
    return {
      success: true,
      patientId,
      snapshotId: "cached",
      rowsWritten: 0,
      completenessFlags: {},
      syncDurationMs: Date.now() - startTime,
    };
  }

  console.log(`[Sync] Starting sync for patient ${patientId}`);

  try {
    // 2. Fetch FHIR Bundle
    const bundle = await fetchPatientBundle(patientId);
    console.log(
      `[Sync] Fetched ${bundle.entry.length} resources in ${Date.now() - startTime}ms`,
    );

    // 3. Transform to flat rows
    const lookbackHours = Number(process.env.SYNC_LOOKBACK_HOURS ?? 72);
    const snapshot = transformBundle(patientId, bundle, lookbackHours);
    console.log(
      `[Sync] Transformed: ${snapshot.allergies.length} allergies, ` +
        `${snapshot.medications.length} meds, ${snapshot.labs.length} labs, ` +
        `${snapshot.vitals.length} vitals, ${snapshot.notes.length} notes`,
    );

    if (!sfAvailable) {
      console.warn(
        "[Sync] Snowflake not available — returning local snapshot only",
      );
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
    const { rowsWritten, snapshotId } = await upsertPatientSnapshot(snapshot);

    const duration = Date.now() - startTime;
    console.log(
      `[Sync] Completed: ${rowsWritten} rows in ${duration}ms (snapshot: ${snapshotId})`,
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

let isPreseeding = false;

/**
 * Background pre-seeding: sync a list of patients sequentially.
 * Includes a lock to prevent concurrent overlapping runs.
 */
export async function preseedCohort(patientIds: string[]): Promise<{
  total: number;
  synced: number;
  errors: number;
}> {
  if (isPreseeding) {
    console.log(
      `[Sync] Pre-seed already running. Ignoring duplicate trigger for ${patientIds.length} patients.`,
    );
    return { total: patientIds.length, synced: 0, errors: 0 };
  }

  isPreseeding = true;
  console.log(`[Sync] Pre-seeding cohort of ${patientIds.length} patients...`);

  let synced = 0;
  let errors = 0;

  try {
    const totalToSync = patientIds.length;
    for (let i = 0; i < totalToSync; i++) {
      // Sleep between patients to let UI render and avoid overwhelming SQLite/API
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }

      const id = patientIds[i];

      try {
        const res = await syncPatient(id);
        if (res.success) {
          synced++;
        } else {
          errors++;
        }
      } catch (e) {
        errors++;
        console.error(`[Sync] Unexpected error pre-seeding ${id}:`, e);
      }
    }
  } finally {
    isPreseeding = false;
  }

  console.log(`[Sync] Pre-seed complete: ${synced} synced, ${errors} errors`);
  return { total: patientIds.length, synced, errors };
}

/**
 * Ask a question about a patient through the Snowflake RAG pipeline.
 * Falls back to local mock if Snowflake is unavailable.
 */
export async function askQuestion(
  patientId: string,
  question: string,
  encounterId?: string,
): Promise<NurseQueryResult> {
  const sfAvailable = await isSnowflakeAvailable();

  if (!sfAvailable) {
    console.warn(
      "[Sync] Snowflake not available — question will use mock service",
    );
    throw new Error("SNOWFLAKE_UNAVAILABLE");
  }

  return callNurseQuery(patientId, question, encounterId);
}

/** Set to false after first 'Unknown function' error so we stop hitting Snowflake for cohort queries */
let cohortProcAvailable = true;

/**
 * Ask a global/cohort question through the Snowflake analytics pipeline.
 */
export async function askGlobalQuestion(
  question: string,
): Promise<NurseQueryResult> {
  const sfAvailable = await isSnowflakeAvailable();

  if (!sfAvailable || !cohortProcAvailable) {
    throw new Error("SNOWFLAKE_UNAVAILABLE");
  }

  try {
    return await callCohortQuery(question);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Unknown function") || msg.includes("does not exist")) {
      cohortProcAvailable = false;
      console.warn(
        "[Sync] PROCESS_COHORT_QUERY stored procedure not found in Snowflake. " +
          "All cohort questions will use the local mock for this session. " +
          "Run snowflake/setup_all.sql to enable full RAG cohort queries.",
      );
    }
    throw new Error("SNOWFLAKE_UNAVAILABLE");
  }
}

// ── Helpers ──

function buildLocalFlags(snapshot: any): Record<string, any> {
  const flags: Record<string, any> = {};

  if (snapshot.labs.length === 0) flags.missing_labs = true;
  if (snapshot.vitals.length === 0) flags.stale_vitals = true;
  if (snapshot.medications.length === 0) flags.no_medications = true;

  return flags;
}
