"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCensus = buildCensus;
exports.getCensus = getCensus;
const fhirClient_1 = require("./fhirClient");
const fhirTransformer_1 = require("./fhirTransformer");
const snowflakeClient_1 = require("./snowflakeClient");
let globalCensus = null;
let isFetchingCensus = false;
/**
 * Maps our flat FHIR snapshot rows into the nested JSON structure
 * expected by the React UI Patient Table.
 */
function mapSnapshotToUIModel(snapshot) {
    if (!snapshot.patient)
        return null;
    const p = snapshot.patient;
    let latestVitals = {
        hr: 0, bpSys: 0, bpDia: 0, rr: 0, temp: 0, spo2: 0, timestamp: new Date().toISOString()
    };
    if (snapshot.vitals && snapshot.vitals.length > 0) {
        const v = snapshot.vitals[0];
        latestVitals = {
            hr: v.hr ?? 0,
            bpSys: v.bp_sys ?? 0,
            bpDia: v.bp_dia ?? 0,
            rr: v.rr ?? 0,
            temp: v.temp ?? 0,
            spo2: v.spo2 ?? 0,
            timestamp: v.effective_dt,
        };
    }
    const uiLabs = snapshot.labs.slice(0, 5).map((l) => ({
        name: l.lab_name,
        value: String(l.value),
        unit: l.unit,
        flag: l.flag,
    }));
    const meds = snapshot.medications.map((m) => m.medication);
    const allergies = snapshot.allergies.map((a) => a.allergen);
    const notes = snapshot.notes.map((n) => n.note_text);
    return {
        id: p.patient_id,
        name: p.name,
        age: p.age,
        sex: p.sex,
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
async function buildCensus(count = 30) {
    if (isFetchingCensus) {
        while (isFetchingCensus) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        if (globalCensus)
            return globalCensus;
    }
    isFetchingCensus = true;
    console.log(`[BFF] Database is empty. Fallback fetch: building census for ${count} patients...`);
    try {
        const fhirPatients = await (0, fhirClient_1.fetchPatientList)(count);
        const patientIds = fhirPatients.map(p => p.id).filter(Boolean);
        console.log(`[BFF] Fetched ${patientIds.length} IDs. Fetching full clinical bundles in parallel...`);
        const lookbackHours = Number(process.env.SYNC_LOOKBACK_HOURS ?? 72);
        const bundlePromises = patientIds.map(async (id) => {
            try {
                const bundle = await (0, fhirClient_1.fetchPatientBundle)(id);
                const snapshot = (0, fhirTransformer_1.transformBundle)(id, bundle, lookbackHours);
                return mapSnapshotToUIModel(snapshot);
            }
            catch (err) {
                console.error(`[BFF] Failed to process patient ${id}:`, err);
                return null;
            }
        });
        const results = await Promise.all(bundlePromises);
        const validPatients = results.filter(p => p !== null);
        validPatients.sort((a, b) => b.riskScore - a.riskScore);
        globalCensus = validPatients;
        console.log(`[BFF] Fallback census built successfully. Cached ${validPatients.length} profiles.`);
        return globalCensus;
    }
    finally {
        isFetchingCensus = false;
    }
}
/**
 * Get the current census.
 * First tries Snowflake for an instant load. Falls back to live FHIR fetch if empty.
 */
async function getCensus() {
    if (globalCensus)
        return globalCensus;
    try {
        const isAvail = await (0, snowflakeClient_1.isSnowflakeAvailable)();
        if (isAvail) {
            console.log("[BFF] Fetching instant census directly from Snowflake...");
            const sfCensus = await (0, snowflakeClient_1.getCensusFromSnowflake)();
            if (sfCensus && sfCensus.length > 0) {
                globalCensus = sfCensus;
                console.log(`[BFF] Instant load complete: ${sfCensus.length} patients.`);
                return globalCensus;
            }
            else {
                console.log("[BFF] Snowflake database is empty. Falling back to live FHIR fetch...");
            }
        }
    }
    catch (err) {
        console.error("[BFF] Failed to load census from Snowflake. Exting gracefully...", err);
    }
    // If we reach here, Snowflake didn't have data (first run).
    // Fall back to the heavy API lift so the UI has something to show.
    return buildCensus();
}
