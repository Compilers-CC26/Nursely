/**
 * FHIR Client — Fetches patient bundles from Synthea FHIR endpoint
 *
 * Supports session-level caching to avoid repeated pulls.
 * Resources fetched: Patient, Encounter, AllergyIntolerance,
 * MedicationRequest, Observation, Condition, DocumentReference
 */

import type { FHIRBundle, FHIRResource } from "./fhirTypes";

const FHIR_BASE =
  process.env.FHIR_BASE_URL || "https://synthea.mitre.org/fhir";

// Session cache: patientId → bundle
const bundleCache = new Map<string, { bundle: FHIRBundle; fetchedAt: Date }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Fetch a comprehensive FHIR Bundle for a single patient.
 * Returns cached result if available and fresh.
 */
export async function fetchPatientBundle(
  patientId: string
): Promise<FHIRBundle> {
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

  const results = await Promise.allSettled(
    resourceTypes.map((type) => fetchResources(patientId, type))
  );

  const entries: FHIRBundle["entry"] = [];

  results.forEach((result, i) => {
    if (result.status === "fulfilled" && result.value.length > 0) {
      console.log(
        `[FHIR]   ${resourceTypes[i]}: ${result.value.length} resources`
      );
      result.value.forEach((resource) => {
        entries.push({ resource, fullUrl: `${FHIR_BASE}/${resource.resourceType}/${resource.id}` });
      });
    } else if (result.status === "rejected") {
      const error = result.reason;
      console.warn(
        `[FHIR]   ${resourceTypes[i]}: fetch failed — ${error instanceof Error ? error.stack : error}`
      );
    }
  });

  const bundle: FHIRBundle = {
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
async function fetchResources(
  patientId: string,
  resourceType: string
): Promise<FHIRResource[]> {
  const paramName = resourceType === "Patient" ? "_id" : "patient";
  const url = `${FHIR_BASE}/${resourceType}?${paramName}=${patientId}&_count=100`;

  const response = await fetch(url, {
    headers: { Accept: "application/fhir+json" },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();

  if (data.resourceType === "Bundle" && data.entry) {
    return data.entry.map((e: any) => e.resource);
  }

  // Single resource response (e.g., Patient by _id)
  if (data.resourceType === resourceType) {
    return [data];
  }

  return [];
}

/**
 * Fetch patient list (basic demographics only).
 * Used for the initial patient table when no local seed is available.
 */
export async function fetchPatientList(
  count = 20
): Promise<FHIRResource[]> {
  const url = `${FHIR_BASE}/Patient?_count=${count}&_sort=-_lastUpdated`;

  const response = await fetch(url, {
    headers: { Accept: "application/fhir+json" },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  return data.entry?.map((e: any) => e.resource) ?? [];
}

/**
 * Clear the session cache (e.g., on logout or manual refresh).
 */
export function clearFHIRCache(): void {
  bundleCache.clear();
  console.log("[FHIR] Cache cleared");
}
