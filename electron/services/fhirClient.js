"use strict";
/**
 * FHIR Client — Fetches patient bundles from Synthea FHIR endpoint
 *
 * Supports session-level caching to avoid repeated pulls.
 * Resources fetched: Patient, Encounter, AllergyIntolerance,
 * MedicationRequest, Observation, Condition, DocumentReference
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchPatientBundle = fetchPatientBundle;
exports.fetchPatientList = fetchPatientList;
exports.clearFHIRCache = clearFHIRCache;
const FHIR_BASE = process.env.FHIR_BASE_URL || "https://r4.smarthealthit.org";
// Session cache: patientId → bundle
const bundleCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
/**
 * Fetch a comprehensive FHIR Bundle for a single patient.
 * Returns cached result if available and fresh.
 */
async function fetchPatientBundle(patientId) {
    // Check cache
    const cached = bundleCache.get(patientId);
    if (cached && Date.now() - cached.fetchedAt.getTime() < CACHE_TTL_MS) {
        console.log(`[FHIR] Using cached bundle for ${patientId}`);
        return cached.bundle;
    }
    console.log(`[FHIR] Fetching bundle for patient ${patientId}...`);
    // Fetch all resource types in parallel
    const resourceTypes = [
        "Patient",
        "Encounter",
        "AllergyIntolerance",
        "MedicationRequest",
        "Observation",
        "Condition",
        "DocumentReference",
    ];
    const results = await Promise.allSettled(resourceTypes.map((type) => fetchResources(patientId, type)));
    const entries = [];
    results.forEach((result, i) => {
        if (result.status === "fulfilled" && result.value.length > 0) {
            console.log(`[FHIR]   ${resourceTypes[i]}: ${result.value.length} resources`);
            result.value.forEach((resource) => {
                entries.push({ resource, fullUrl: `${FHIR_BASE}/${resource.resourceType}/${resource.id}` });
            });
        }
        else if (result.status === "rejected") {
            const error = result.reason;
            console.warn(`[FHIR]   ${resourceTypes[i]}: fetch failed — ${error instanceof Error ? error.stack : error}`);
        }
    });
    const bundle = {
        resourceType: "Bundle",
        type: "searchset",
        total: entries.length,
        entry: entries,
    };
    // Cache
    bundleCache.set(patientId, { bundle, fetchedAt: new Date() });
    console.log(`[FHIR] Bundle complete: ${entries.length} total resources`);
    return bundle;
}
/**
 * Fetch resources of a specific type for a patient.
 */
async function fetchResources(patientId, resourceType) {
    const paramName = resourceType === "Patient" ? "_id" : "patient";
    // Use clinical/standard URL format
    const url = resourceType === "Patient"
        ? `${FHIR_BASE}/Patient/${patientId}`
        : `${FHIR_BASE}/${resourceType}?${paramName}=${patientId}&_count=100`;
    try {
        const response = await fetch(url, {
            headers: {
                Accept: "application/fhir+json",
                "User-Agent": "PatientAnalyst/1.0.0 (Electron; ClinicalAssistant)"
            },
        });
        if (!response.ok) {
            console.warn(`[FHIR] Fetch failed for ${resourceType} (${response.status}).`);
            return [];
        }
        const data = await response.json();
        if (data.resourceType === "Bundle" && data.entry) {
            return data.entry.map((e) => e.resource);
        }
        else if (data.resourceType === resourceType) {
            return [data];
        }
        return [];
    }
    catch (err) {
        console.warn(`[FHIR] Network error for ${resourceType}:`, err);
        return [];
    }
}
/**
 * Fetch patient list (basic demographics only).
 * Used for the initial patient table when no local seed is available.
 */
async function fetchPatientList(count = 20) {
    const url = `${FHIR_BASE}/Patient?_count=${count}&_sort=-_lastUpdated`;
    const response = await fetch(url, {
        headers: { Accept: "application/fhir+json" },
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    return data.entry?.map((e) => e.resource) ?? [];
}
/**
 * Clear the session cache (e.g., on logout or manual refresh).
 */
function clearFHIRCache() {
    bundleCache.clear();
    console.log("[FHIR] Cache cleared");
}
