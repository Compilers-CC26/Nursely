import { fetchPatientList, fetchPatientBundle } from "./fhirClient";
import { transformBundle } from "./fhirTransformer";
import { getCensusFromSnowflake, isSnowflakeAvailable, getPatientFromSnowflake } from "./snowflakeClient";
import type { Patient, Vitals, Lab } from "../../src/types";

let globalCensus: Patient[] | null = null;
let isFetchingCensus = false;

/**
 * Maps our flat FHIR snapshot rows into the nested JSON structure
 * expected by the React UI Patient Table.
 */
function mapSnapshotToUIModel(snapshot: any): Patient | null {
  if (!snapshot.patient) return null;

  const p = snapshot.patient;

  let latestVitals: Vitals = {
    hr: null, bpSys: null, bpDia: null, rr: null, temp: null, spo2: null, timestamp: new Date().toISOString()
  };
  if (snapshot.vitals && snapshot.vitals.length > 0) {
    for (const v of snapshot.vitals) {
      if (!v) continue;
      // Use helper to get value regardless of property casing or naming (handle bp_sys vs bpSys)
      const getV = (key: string, altKey?: string): number | null => {
        const val = v[key] !== undefined ? v[key] : (altKey ? v[altKey] : undefined);
        return (val === null || val === undefined) ? null : Number(val);
      };

      const hr = getV("hr");
      if (latestVitals.hr === null && hr !== null) latestVitals.hr = hr;

      const bpSys = getV("bp_sys", "bpSys");
      if (latestVitals.bpSys === null && bpSys !== null) latestVitals.bpSys = bpSys;

      const bpDia = getV("bp_dia", "bpDia");
      if (latestVitals.bpDia === null && bpDia !== null) latestVitals.bpDia = bpDia;

      const rr = getV("rr");
      if (latestVitals.rr === null && rr !== null) latestVitals.rr = rr;

      const temp = getV("temp");
      if (latestVitals.temp === null && temp !== null) {
        // Synthea usually returns Celsius. UI expects Fahrenheit.
        // Also safeguard against double conversion if it's already large
        latestVitals.temp = temp < 50 ? parseFloat((temp * 9 / 5 + 32).toFixed(1)) : temp;
      }

      const spo2 = getV("spo2");
      if (latestVitals.spo2 === null && spo2 !== null) latestVitals.spo2 = spo2;

      // Update timestamp to the first matching valid row
      if (latestVitals.timestamp.startsWith("2026") && (hr !== null || bpSys !== null || rr !== null || temp !== null || spo2 !== null)) {
          latestVitals.timestamp = v.effective_dt || v.timestamp || latestVitals.timestamp;
      }
    }
  }

  const uiLabs: Lab[] = snapshot.labs.slice(0, 5).map((l: any) => ({
    name: l.lab_name,
    value: String(l.value),
    unit: l.unit,
    flag: l.flag as "normal" | "high" | "low" | "critical",
  }));

  const meds = snapshot.medications.map((m: any) => m.medication);
  const allergies = snapshot.allergies.map((a: any) => a.allergen);
  const notes = snapshot.notes.map((n: any) => n.note_text);

  return {
    id: p.patient_id,
    name: p.name,
    age: p.age,
    sex: p.sex as "M" | "F",
    room: p.room,
    mrn: p.mrn,
    diagnosis: p.diagnosis,
    summary: p.summary,
    vitals: latestVitals,
    labs: uiLabs,
    meds,
    allergies,
    notes,
    riskScore: p.risk_score,
  };
}

/**
 * Fallback: Builds the dynamic in-memory BFF census if Snowflake is empty.
 * Fetches recent patients from FHIR, gets full bundles, and shapes data.
 */
export async function buildCensus(
  targetCount = 50,
  onUpdate?: (patient: Patient) => void
): Promise<Patient[]> {
  if (isFetchingCensus) {
    while (isFetchingCensus) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    if (globalCensus) return globalCensus;
  }

  isFetchingCensus = true;
  // Fetch more raw patients than we need because some will fail validation
  // Synthea data is very sparse, so many patients are dropped. We need a larger buffer.
  const fetchCount = Math.floor(targetCount * 10.0);
  console.log(`[BFF] Database is empty. Fallback fetch: requesting ${fetchCount} raw patients to build a census of ${targetCount}...`);

  try {
    const fhirPatients = await fetchPatientList(fetchCount);
    // Deduplicate IDs immediately to prevent redundant fetching
    const rawIds = fhirPatients.map(p => p.id).filter(Boolean) as string[];
    const patientIds = Array.from(new Set(rawIds));

    console.log(`[BFF] Fetched ${patientIds.length} unique IDs. Fetching full clinical bundles in batches...`);
    const lookbackHours = Number(process.env.SYNC_LOOKBACK_HOURS ?? 72);
    const validPatients: Patient[] = [];
    const batchSize = 10;

    for (let i = 0; i < patientIds.length && validPatients.length < targetCount; i += batchSize) {
      const batchIds = patientIds.slice(i, i + batchSize);
      console.log(`[BFF] Processing batch ${Math.floor(i / batchSize) + 1} (${batchIds.length} IDs)...`);

      const batchResults = await Promise.all(
        batchIds.map(async (id) => {
          try {
            const bundle = await fetchPatientBundle(id);
            const snapshot = transformBundle(id, bundle, lookbackHours);

            if (!snapshot.patient) {
              console.log(`[BFF Debug] Patient ${id} dropped: Missing core patient data.`);
              return null;
            }

            const uiModel = mapSnapshotToUIModel(snapshot);
            if (uiModel && onUpdate) {
              onUpdate(uiModel);
            }
            return uiModel;
          } catch (err) {
            console.log(`[BFF Debug] Patient ${id} error: ${err instanceof Error ? err.message : String(err)}`);
            return null;
          }
        })
      );

      const batchValid = batchResults.filter(p => p !== null) as Patient[];
      validPatients.push(...batchValid);
      console.log(`[BFF] Batch complete. Total valid so far: ${validPatients.length}/${targetCount}`);

      // Small pause between batches if it was too fast
      if (validPatients.length < targetCount) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log(`[BFF Debug] Finished processing all reachable IDs. Valid: ${validPatients.length}, Total IDs: ${patientIds.length}`);
    validPatients.sort((a, b) => b.riskScore - a.riskScore);

    // Trim down to exactly the requested count
    globalCensus = validPatients.slice(0, targetCount);
    console.log(`[BFF] Fallback census built successfully. Cached ${globalCensus.length} profiles (from ${validPatients.length} valid).`);
    return globalCensus;
  } finally {
    isFetchingCensus = false;
  }
}

/**
 * Get the current census.
 * First tries Snowflake for an instant load. Falls back to live FHIR fetch if empty.
 */
export async function getCensus(
  forceRefresh = false,
  onUpdate?: (p: Patient) => void
): Promise<Patient[]> {
  if (globalCensus && !forceRefresh) return globalCensus;

  const log = (message: string) => console.log(`[BFF] ${message}`);

  try {
    const isAvail = await isSnowflakeAvailable();
    if (isAvail) {
      log("Checking Snowflake for census...");
      const sfCensus = await getCensusFromSnowflake();
      // Only use Snowflake if it has a substantial cohort (at least 50)
      // Otherwise, the DB might be in a "partially hydrated" state from a previous crash/interruption.
      if (sfCensus && sfCensus.length >= 50 && !forceRefresh) {
        globalCensus = sfCensus;
        log(`Instant load complete: ${sfCensus.length} patients from Snowflake.`);
        return globalCensus;
      } else if (sfCensus && sfCensus.length > 0) {
        log(`Snowflake only has ${sfCensus.length} patients. Falling back to live FHIR for full census.`);
      } else {
        log("Snowflake database is empty. Falling back to live FHIR fetch...");
      }
    }
  } catch (err) {
    log(`Failed to load census from Snowflake: ${err}`);
  }

  // Fallback to live FHIR fetch if Snowflake is empty, failing, or contains too few results
  globalCensus = await buildCensus(50, onUpdate);
  return globalCensus;
}

/**
 * Get a single patient by ID, pulling fresh from Snowflake if possible.
 */
export async function getPatientById(patientId: string): Promise<Patient | null> {
  const isAvail = await isSnowflakeAvailable();
  if (isAvail) {
    try {
      const sfPatient = await getPatientFromSnowflake(patientId);
      if (sfPatient) return sfPatient;
    } catch (err) {
      console.error(`[BFF] Failed to get patient ${patientId} from Snowflake:`, err);
    }
  }

  // If Snowflake fails or doesn't have it, we could fallback to FHIR,
  // but for the "Sync Refresh" use case, Snowflake should have it.
  return null;
}
