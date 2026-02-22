/**
 * Snowflake Client — Handles connection, upserts, and query execution
 *
 * Uses the Snowflake Node.js SDK for:
 *   1. MERGE-based upserts from FHIR-transformed rows
 *   2. Calling process_nurse_query() stored procedure
 *   3. Cohort analytics queries
 *   4. Snapshot timestamp tracking
 */

import snowflake from "snowflake-sdk";
import type {
  TransformedSnapshot,
  PatientRow,
  AllergyRow,
  MedicationRow,
  LabRow,
  VitalRow,
  NoteRow,
} from "./fhirTypes";

// ── Connection config ──

interface SnowflakeConfig {
  account: string;
  username: string;
  password: string;
  warehouse: string;
  database: string;
  schema: string;
}

function getConfig(): SnowflakeConfig {
  return {
    account: process.env.SNOWFLAKE_ACCOUNT ?? "",
    username: process.env.SNOWFLAKE_USER ?? "",
    password: process.env.SNOWFLAKE_PASSWORD ?? "",
    warehouse: process.env.SNOWFLAKE_WAREHOUSE ?? "PATIENT_ANALYST_WH",
    database: process.env.SNOWFLAKE_DATABASE ?? "PATIENT_ANALYST",
    schema: process.env.SNOWFLAKE_SCHEMA ?? "PUBLIC",
  };
}

let connection: snowflake.Connection | null = null;

/**
 * Get or create a Snowflake connection.
 */
export async function getConnection(): Promise<snowflake.Connection> {
  if (connection) return connection;

  const config = getConfig();

  if (!config.account || !config.username) {
    throw new Error(
      "Snowflake not configured. Set SNOWFLAKE_ACCOUNT and SNOWFLAKE_USER in .env"
    );
  }

  return new Promise((resolve, reject) => {
    const conn = snowflake.createConnection({
      account: config.account,
      username: config.username,
      password: config.password,
      warehouse: config.warehouse,
      database: config.database,
      schema: config.schema,
    });

    conn.connect((err, conn) => {
      if (err) {
        console.error("[Snowflake] Connection failed:", err.message);
        reject(err);
      } else {
        console.log("[Snowflake] Connected successfully");
        connection = conn;
        resolve(conn);
      }
    });
  });
}

/**
 * Execute a SQL statement and return results.
 */
async function executeSql(
  sql: string,
  binds: any[] = []
): Promise<any[]> {
  const conn = await getConnection();

  return new Promise((resolve, reject) => {
    conn.execute({
      sqlText: sql,
      binds,
      complete: (err, _stmt, rows) => {
        if (err) {
          console.error("[Snowflake] SQL Error:", err.message);
          reject(err);
        } else {
          resolve(rows ?? []);
        }
      },
    });
  });
}

// ── Upsert operations ──

/**
 * Upsert a full patient snapshot into Snowflake tables.
 * Uses MERGE semantics for idempotent writes.
 */
export async function upsertPatientSnapshot(
  snapshot: TransformedSnapshot
): Promise<{ rowsWritten: number; snapshotId: string }> {
  let rowsWritten = 0;

  // 1. Patient first (required for foreign keys)
  if (snapshot.patient) {
    await upsertPatient(snapshot.patient);
    rowsWritten++;
  }

  // 2. Batch Allergies
  if (snapshot.allergies.length > 0) {
    console.log(`[Sync] Batch upserting ${snapshot.allergies.length} allergies...`);
    await upsertAllergiesBatch(snapshot.allergies);
    rowsWritten += snapshot.allergies.length;
  }

  // 3. Batch Medications
  if (snapshot.medications.length > 0) {
    console.log(`[Sync] Batch upserting ${snapshot.medications.length} medications...`);
    await upsertMedicationsBatch(snapshot.medications);
    rowsWritten += snapshot.medications.length;
  }

  // 4. Batch Labs
  if (snapshot.labs.length > 0) {
    console.log(`[Sync] Batch upserting ${snapshot.labs.length} labs...`);
    await upsertLabsBatch(snapshot.labs);
    rowsWritten += snapshot.labs.length;
  }

  // 5. Batch Vitals
  if (snapshot.vitals.length > 0) {
    console.log(`[Sync] Batch upserting ${snapshot.vitals.length} vitals...`);
    await upsertVitalsBatch(snapshot.vitals);
    rowsWritten += snapshot.vitals.length;
  }

  // 6. Batch Notes
  if (snapshot.notes.length > 0) {
    console.log(`[Sync] Batch upserting ${snapshot.notes.length} notes...`);
    await upsertNotesBatch(snapshot.notes);
    rowsWritten += snapshot.notes.length;
  }

  // 7. Batch Raw FHIR storage
  if (snapshot.rawResources.length > 0) {
    const BATCH_SIZE = 20; // Slightly smaller batch for better stability
    console.log(`[Sync] Batching ${snapshot.rawResources.length} raw resources...`);
    for (let i = 0; i < snapshot.rawResources.length; i += BATCH_SIZE) {
      const batch = snapshot.rawResources.slice(i, i + BATCH_SIZE);
      const sqlParts: string[] = [];
      const binds: any[] = [];

      batch.forEach((raw, idx) => {
        const rawId = `${snapshot.patient?.patient_id}-${raw.resource_type}-${Date.now()}-${i + idx}`;
        sqlParts.push(`SELECT ? AS raw_id, ? AS patient_id, ? AS resource_type, PARSE_JSON(?) AS raw_json, CURRENT_TIMESTAMP() AS ingested_at`);
        binds.push(rawId, snapshot.patient?.patient_id ?? "", raw.resource_type, JSON.stringify(raw.raw_json));
      });

      await executeSql(
        `INSERT INTO fhir_raw (raw_id, patient_id, resource_type, raw_json, ingested_at)
         ${sqlParts.join(" UNION ALL ")}`,
        binds
      );
    }
  }

  // 8. Write snapshot record
  const snapshotId = `snap-${Date.now()}`;
  await executeSql(
    `INSERT INTO patient_snapshots (snapshot_id, patient_id, snapshot_at, lookback_hours, completeness_flags, resource_counts)
     SELECT ?, ?, CURRENT_TIMESTAMP(), ?, PARSE_JSON(?), PARSE_JSON(?) FROM (SELECT 1)`,
    [
      snapshotId,
      snapshot.patient?.patient_id ?? "",
      Number(process.env.SYNC_LOOKBACK_HOURS ?? 72),
      JSON.stringify(buildCompletenessFlags(snapshot)),
      JSON.stringify({
        allergies: snapshot.allergies.length,
        medications: snapshot.medications.length,
        labs: snapshot.labs.length,
        vitals: snapshot.vitals.length,
        notes: snapshot.notes.length,
      }),
    ]
  );

  console.log(
    `[Snowflake] Upserted ${rowsWritten} rows for patient ${snapshot.patient?.patient_id}`
  );
  return { rowsWritten, snapshotId };
}

async function upsertPatient(p: PatientRow) {
  await executeSql(
    `MERGE INTO patients AS t
     USING (SELECT ? AS patient_id, ? AS name, ? AS age, ? AS sex, ? AS room,
                   ? AS mrn, ? AS diagnosis, ? AS summary, ? AS risk_score,
                   ? AS fhir_resource_id, ? AS fhir_last_updated, ? AS source_system) AS s
     ON t.patient_id = s.patient_id
     WHEN MATCHED THEN UPDATE SET
       t.name = s.name, t.age = s.age, t.sex = s.sex, t.room = s.room, t.mrn = s.mrn,
       t.diagnosis = s.diagnosis, t.summary = s.summary, t.risk_score = s.risk_score,
       t.fhir_resource_id = s.fhir_resource_id, t.fhir_last_updated = s.fhir_last_updated,
       t.updated_at = CURRENT_TIMESTAMP()
     WHEN NOT MATCHED THEN INSERT
       (patient_id, name, age, sex, room, mrn, diagnosis, summary, risk_score,
        fhir_resource_id, fhir_last_updated, source_system)
     VALUES (s.patient_id, s.name, s.age, s.sex, s.room, s.mrn, s.diagnosis, s.summary,
             s.risk_score, s.fhir_resource_id, s.fhir_last_updated, s.source_system)`,
    [
      p.patient_id, p.name, p.age, p.sex, p.room, p.mrn, p.diagnosis,
      p.summary, p.risk_score, p.fhir_resource_id,
      p.fhir_last_updated, p.source_system,
    ]
  );
}

async function upsertAllergiesBatch(allergies: AllergyRow[]) {
  const BATCH_SIZE = 40;
  for (let i = 0; i < allergies.length; i += BATCH_SIZE) {
    const batch = allergies.slice(i, i + BATCH_SIZE);
    const sqlParts = batch.map(() => `SELECT ? AS allergy_id, ? AS patient_id, ? AS allergen, ? AS reaction, ? AS severity, ? AS fhir_resource_type, ? AS fhir_resource_id, ? AS fhir_last_updated, ? AS source_system`).join(" UNION ALL ");
    const binds = batch.flatMap(a => [a.allergy_id, a.patient_id, a.allergen, a.reaction, a.severity, a.fhir_resource_type, a.fhir_resource_id, a.fhir_last_updated, a.source_system]);
    await executeSql(`
      MERGE INTO allergies AS t
      USING (${sqlParts}) AS s
      ON t.allergy_id = s.allergy_id
      WHEN MATCHED THEN UPDATE SET t.allergen = s.allergen, t.reaction = s.reaction, t.severity = s.severity
      WHEN NOT MATCHED THEN INSERT (allergy_id, patient_id, allergen, reaction, severity, fhir_resource_type, fhir_resource_id, fhir_last_updated, source_system)
      VALUES (s.allergy_id, s.patient_id, s.allergen, s.reaction, s.severity, s.fhir_resource_type, s.fhir_resource_id, s.fhir_last_updated, s.source_system)
    `, binds);
  }
}

async function upsertMedicationsBatch(meds: MedicationRow[]) {
  const BATCH_SIZE = 40;
  for (let i = 0; i < meds.length; i += BATCH_SIZE) {
    const batch = meds.slice(i, i + BATCH_SIZE);
    const sqlParts = batch.map(() => `SELECT ? AS medication_id, ? AS patient_id, ? AS medication, ? AS status, ? AS dosage, ? AS route, ? AS frequency, ? AS fhir_resource_type, ? AS fhir_resource_id, ? AS fhir_last_updated, ? AS source_system`).join(" UNION ALL ");
    const binds = batch.flatMap(m => [m.medication_id, m.patient_id, m.medication, m.status, m.dosage, m.route, m.frequency, m.fhir_resource_type, m.fhir_resource_id, m.fhir_last_updated, m.source_system]);
    await executeSql(`
      MERGE INTO medications AS t
      USING (${sqlParts}) AS s
      ON t.medication_id = s.medication_id
      WHEN MATCHED THEN UPDATE SET t.medication = s.medication, t.status = s.status, t.dosage = s.dosage, t.route = s.route, t.frequency = s.frequency
      WHEN NOT MATCHED THEN INSERT (medication_id, patient_id, medication, status, dosage, route, frequency, fhir_resource_type, fhir_resource_id, fhir_last_updated, source_system)
      VALUES (s.medication_id, s.patient_id, s.medication, s.status, s.dosage, s.route, s.frequency, s.fhir_resource_type, s.fhir_resource_id, s.fhir_last_updated, s.source_system)
    `, binds);
  }
}

async function upsertLabsBatch(labs: LabRow[]) {
  const BATCH_SIZE = 40;
  for (let i = 0; i < labs.length; i += BATCH_SIZE) {
    const batch = labs.slice(i, i + BATCH_SIZE);
    const sqlParts = batch.map(() => `SELECT ? AS lab_id, ? AS patient_id, ? AS lab_name, ? AS value, ? AS unit, ? AS flag, ? AS effective_dt, ? AS fhir_resource_type, ? AS fhir_resource_id, ? AS fhir_last_updated, ? AS source_system`).join(" UNION ALL ");
    const binds = batch.flatMap(l => [l.lab_id, l.patient_id, l.lab_name, l.value, l.unit, l.flag, l.effective_dt, l.fhir_resource_type, l.fhir_resource_id, l.fhir_last_updated, l.source_system]);
    await executeSql(`
      MERGE INTO lab_results AS t
      USING (${sqlParts}) AS s
      ON t.lab_id = s.lab_id
      WHEN MATCHED THEN UPDATE SET t.lab_name = s.lab_name, t.value = s.value, t.unit = s.unit, t.flag = s.flag, t.effective_dt = s.effective_dt
      WHEN NOT MATCHED THEN INSERT (lab_id, patient_id, lab_name, value, unit, flag, effective_dt, fhir_resource_type, fhir_resource_id, fhir_last_updated, source_system)
      VALUES (s.lab_id, s.patient_id, s.lab_name, s.value, s.unit, s.flag, s.effective_dt, s.fhir_resource_type, s.fhir_resource_id, s.fhir_last_updated, s.source_system)
    `, binds);
  }
}

async function upsertVitalsBatch(vitals: VitalRow[]) {
  const BATCH_SIZE = 40;
  for (let i = 0; i < vitals.length; i += BATCH_SIZE) {
    const batch = vitals.slice(i, i + BATCH_SIZE);
    const sqlParts = batch.map(() => `SELECT ? AS vital_id, ? AS patient_id, ? AS hr, ? AS bp_sys, ? AS bp_dia, ? AS rr, ? AS temp, ? AS spo2, ? AS effective_dt, ? AS fhir_resource_type, ? AS fhir_resource_id, ? AS fhir_last_updated, ? AS source_system`).join(" UNION ALL ");
    const binds = batch.flatMap(v => [v.vital_id, v.patient_id, v.hr, v.bp_sys, v.bp_dia, v.rr, v.temp, v.spo2, v.effective_dt, v.fhir_resource_type, v.fhir_resource_id, v.fhir_last_updated, v.source_system]);
    await executeSql(`
      MERGE INTO vitals AS t
      USING (${sqlParts}) AS s
      ON t.vital_id = s.vital_id
      WHEN MATCHED THEN UPDATE SET t.hr = s.hr, t.bp_sys = s.bp_sys, t.bp_dia = s.bp_dia, t.rr = s.rr, t.temp = s.temp, t.spo2 = s.spo2, t.effective_dt = s.effective_dt
      WHEN NOT MATCHED THEN INSERT (vital_id, patient_id, hr, bp_sys, bp_dia, rr, temp, spo2, effective_dt, fhir_resource_type, fhir_resource_id, fhir_last_updated, source_system)
      VALUES (s.vital_id, s.patient_id, s.hr, s.bp_sys, s.bp_dia, s.rr, s.temp, s.spo2, s.effective_dt, s.fhir_resource_type, s.fhir_resource_id, s.fhir_last_updated, s.source_system)
    `, binds);
  }
}

async function upsertNotesBatch(notes: NoteRow[]) {
  const BATCH_SIZE = 40;
  for (let i = 0; i < notes.length; i += BATCH_SIZE) {
    const batch = notes.slice(i, i + BATCH_SIZE);
    const sqlParts = batch.map(() => `SELECT ? AS note_id, ? AS patient_id, ? AS note_text, ? AS author, ? AS note_dt, ? AS fhir_resource_type, ? AS fhir_resource_id, ? AS fhir_last_updated, ? AS source_system`).join(" UNION ALL ");
    const binds = batch.flatMap(n => [n.note_id, n.patient_id, n.note_text, n.author, n.note_dt, n.fhir_resource_type, n.fhir_resource_id, n.fhir_last_updated, n.source_system]);
    await executeSql(`
      MERGE INTO nursing_notes AS t
      USING (${sqlParts}) AS s
      ON t.note_id = s.note_id
      WHEN MATCHED THEN UPDATE SET t.note_text = s.note_text, t.author = s.author, t.note_dt = s.note_dt
      WHEN NOT MATCHED THEN INSERT (note_id, patient_id, note_text, author, note_dt, fhir_resource_type, fhir_resource_id, fhir_last_updated, source_system)
      VALUES (s.note_id, s.patient_id, s.note_text, s.author, s.note_dt, s.fhir_resource_type, s.fhir_resource_id, s.fhir_last_updated, s.source_system)
    `, binds);
  }
}

// ── Query operations ──

export interface NurseQueryResult {
  answer: string;
  citations: Array<{
    title: string;
    source: string;
    url: string;
  }>;
  flags: string[];
  dataAsOf: string;
}

/**
 * Call the process_nurse_query stored procedure.
 */
export async function callNurseQuery(
  patientId: string,
  question: string,
  encounterId?: string
): Promise<NurseQueryResult> {
  const sql = encounterId
    ? `CALL process_nurse_query(?, ?, ?)`
    : `CALL process_nurse_query(?, ?)`;
  const binds = encounterId
    ? [patientId, question, encounterId]
    : [patientId, question];

  const rows = await executeSql(sql, binds);

  if (rows.length === 0) {
    throw new Error("No result from stored procedure");
  }

  const result = rows[0]?.PROCESS_NURSE_QUERY ?? rows[0];
  const parsed = typeof result === "string" ? JSON.parse(result) : result;

  // Parse citations from search results
  const citations = parseCitations(parsed.search_results);

  return {
    answer: parsed.answer ?? "No answer generated.",
    citations,
    flags: parseFlags(parsed.completeness_flags),
    dataAsOf: parsed.data_as_of ?? new Date().toISOString(),
  };
}

/**
 * Run a cohort summary analytics query.
 */
export async function getCohortSummary(): Promise<any> {
  const rows = await executeSql(`
    SELECT
      COUNT(*) AS total_patients,
      AVG(risk_score) AS avg_risk,
      COUNT(CASE WHEN risk_score > 0.8 THEN 1 END) AS high_risk_count,
      ARRAY_AGG(DISTINCT diagnosis) AS diagnoses
    FROM patients
  `);
  return rows[0] ?? {};
}

/**
 * Get the latest sync timestamp for a patient.
 */
export async function getLastSyncTime(patientId: string): Promise<Date | null> {
  const rows = await executeSql(`
    SELECT DATE_PART(epoch_millisecond, snapshot_at) as snapshot_ms
    FROM patient_snapshots
    WHERE patient_id = ?
    ORDER BY snapshot_at DESC
    LIMIT 1
  `, [patientId]);

  if (rows.length === 0) return null;
  return new Date(Number(rows[0].SNAPSHOT_MS));
}

/**
 * Check if a patient was synced within a lookback window.
 */
export async function isPatientSyncedRecent(patientId: string, minutesThreshold = 10): Promise<boolean> {
  const lastSync = await getLastSyncTime(patientId);
  if (!lastSync) return false;

  const diffMs = Date.now() - lastSync.getTime();
  const diffMin = diffMs / (1000 * 60);
  return diffMin < minutesThreshold;
}

/**
 * Retrieve the current patient census directly from Snowflake.
 * Used for instant app launch before background FHIR updates.
 */
export async function getCensusFromSnowflake(): Promise<any[]> {
  const sql = `
    SELECT
      p.patient_id, p.name, p.age, p.sex, p.room, p.mrn, p.diagnosis, p.summary, p.risk_score,
      v.vitals_obj AS vitals,
      l.labs_arr AS labs,
      m.meds_arr AS meds,
      a.allergies_arr AS allergies,
      n.notes_arr AS notes
    FROM patients p
    LEFT JOIN (
      SELECT patient_id,
        OBJECT_CONSTRUCT(
          'hr', hr, 'bpSys', bp_sys, 'bpDia', bp_dia, 'rr', rr, 'temp', temp, 'spo2', spo2, 'timestamp', effective_dt
        ) AS vitals_obj
      FROM vitals
      QUALIFY ROW_NUMBER() OVER(PARTITION BY patient_id ORDER BY effective_dt DESC NULLS LAST) = 1
    ) v ON v.patient_id = p.patient_id
    LEFT JOIN (
      SELECT patient_id, ARRAY_AGG(OBJECT_CONSTRUCT(
        'name', lab_name, 'value', value, 'unit', unit, 'flag', flag
      )) AS labs_arr
      FROM (
        SELECT patient_id, lab_name, value, unit, flag, effective_dt
        FROM lab_results
        QUALIFY ROW_NUMBER() OVER(PARTITION BY patient_id ORDER BY effective_dt DESC) <= 5
      )
      GROUP BY patient_id
    ) l ON l.patient_id = p.patient_id
    LEFT JOIN (
      SELECT patient_id, ARRAY_AGG(medication) AS meds_arr
      FROM medications
      GROUP BY patient_id
    ) m ON m.patient_id = p.patient_id
    LEFT JOIN (
      SELECT patient_id, ARRAY_AGG(allergen) AS allergies_arr
      FROM allergies
      GROUP BY patient_id
    ) a ON a.patient_id = p.patient_id
    LEFT JOIN (
      SELECT patient_id, ARRAY_AGG(note_text) AS notes_arr
      FROM nursing_notes
      GROUP BY patient_id
    ) n ON n.patient_id = p.patient_id
    ORDER BY p.risk_score DESC NULLS LAST
  `;

  const rows = await executeSql(sql);

  return rows.map(r => ({
    id: r.PATIENT_ID,
    name: r.NAME,
    age: r.AGE,
    sex: r.SEX,
    room: r.ROOM,
    mrn: r.MRN,
    diagnosis: r.DIAGNOSIS,
    summary: r.SUMMARY,
    riskScore: r.RISK_SCORE ?? 0,
    vitals: r.VITALS ? (typeof r.VITALS === 'string' ? JSON.parse(r.VITALS) : r.VITALS) : { hr: 0, bpSys: 0, bpDia: 0, rr: 0, temp: 0, spo2: 0, timestamp: new Date().toISOString() },
    labs: r.LABS ? (typeof r.LABS === 'string' ? JSON.parse(r.LABS) : r.LABS) : [],
    meds: r.MEDS ? (typeof r.MEDS === 'string' ? JSON.parse(r.MEDS) : r.MEDS) : [],
    allergies: r.ALLERGIES ? (typeof r.ALLERGIES === 'string' ? JSON.parse(r.ALLERGIES) : r.ALLERGIES) : [],
    notes: r.NOTES ? (typeof r.NOTES === 'string' ? JSON.parse(r.NOTES) : r.NOTES) : []
  }));
}

/**
 * Check if Snowflake is configured and connectable.
 */
export async function isSnowflakeAvailable(): Promise<boolean> {
  try {
    const config = getConfig();
    if (!config.account || !config.username) return false;
    await getConnection();
    return true;
  } catch {
    return false;
  }
}

/**
 * Close the Snowflake connection.
 */
export function closeConnection(): void {
  if (connection) {
    connection.destroy((err) => {
      if (err) console.error("[Snowflake] Error closing connection:", err);
      else console.log("[Snowflake] Connection closed");
    });
    connection = null;
  }
}

// ── Helpers ──

function buildCompletenessFlags(snapshot: TransformedSnapshot): Record<string, any> {
  const flags: Record<string, any> = {};

  if (snapshot.labs.length === 0) {
    flags.missing_labs = true;
  }

  if (snapshot.vitals.length === 0) {
    flags.stale_vitals = true;
  }

  if (snapshot.medications.length === 0) {
    flags.no_medications = true;
  }

  // Check for specific critical labs
  const labNames = new Set(snapshot.labs.map((l) => l.lab_name.toLowerCase()));
  const criticalLabs = ["potassium", "creatinine", "lactate", "troponin"];
  const missing = criticalLabs.filter((l) =>
    !Array.from(labNames).some((name) => name.includes(l))
  );
  if (missing.length > 0) {
    flags.missing_critical_labs = missing;
  }

  return flags;
}

function parseCitations(
  searchResults: any
): Array<{ title: string; source: string; url: string }> {
  if (!searchResults) return [];

  try {
    const results =
      typeof searchResults === "string"
        ? JSON.parse(searchResults)
        : searchResults;

    if (Array.isArray(results)) {
      return results.map((r: any) => ({
        title: r.source_title ?? r.title ?? "Unknown",
        source: r.category ?? "Hospital Protocol",
        url: `#protocol-${r.policy_id ?? r.doc_id ?? "unknown"}`,
      }));
    }

    // Handle Cortex Search response format
    if (results.results && Array.isArray(results.results)) {
      return results.results.map((r: any) => ({
        title: r.source_title ?? "Unknown",
        source: r.category ?? "Hospital Protocol",
        url: `#protocol-${r.policy_id ?? "unknown"}`,
      }));
    }
  } catch {
    console.warn("[Snowflake] Could not parse citations");
  }

  return [];
}

function parseFlags(completenessFlags: any): string[] {
  if (!completenessFlags) return [];

  const flags: string[] = [];
  const parsed =
    typeof completenessFlags === "string"
      ? JSON.parse(completenessFlags)
      : completenessFlags;

  if (parsed.missing_labs) flags.push("No recent labs available");
  if (parsed.stale_vitals) flags.push("Vitals data may be stale");
  if (parsed.no_medications) flags.push("No medications documented");
  if (parsed.missing_critical_labs) {
    flags.push(
      `Missing critical labs: ${parsed.missing_critical_labs.join(", ")}`
    );
  }

  return flags;
}
