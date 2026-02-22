/**
 * FHIR Client — Fetches patient bundles from Synthea FHIR endpoint
 *
 * Supports session-level caching to avoid repeated pulls.
 * Resources fetched: Patient, Encounter, AllergyIntolerance,
 * MedicationRequest, Observation, Condition, DocumentReference
 */

import type { FHIRBundle, FHIRResource } from "./fhirTypes";

const FHIR_BASE = process.env.FHIR_BASE_URL || "https://r4.smarthealthit.org";

// Session cache: patientId → bundle
const bundleCache = new Map<string, { bundle: FHIRBundle; fetchedAt: Date }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Fetch a comprehensive FHIR Bundle for a single patient.
 * Returns cached result if available and fresh.
 */
export async function fetchPatientBundle(
  patientId: string,
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
    resourceTypes.map((type) => fetchResources(patientId, type)),
  );

  const entries: FHIRBundle["entry"] = [];

  results.forEach((result, i) => {
    if (result.status === "fulfilled" && result.value.length > 0) {
      console.log(
        `[FHIR]   ${resourceTypes[i]}: ${result.value.length} resources`,
      );
      result.value.forEach((resource) => {
        entries.push({
          resource,
          fullUrl: `${FHIR_BASE}/${resource.resourceType}/${resource.id}`,
        });
      });
    } else if (result.status === "rejected") {
      const error = result.reason;
      console.warn(
        `[FHIR]   ${resourceTypes[i]}: fetch failed — ${error instanceof Error ? error.stack : error}`,
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
  resourceType: string,
): Promise<FHIRResource[]> {
  const paramName = resourceType === "Patient" ? "_id" : "patient";
  // NOTE: Do NOT use &_sort=-date — it is NOT a valid sort param for Condition
  // (valid: onset-date, recorded-date) or MedicationRequest (valid: authoredon).
  // The server returns 4xx which fetchWithRetry silently converts to [].
  // Sorting is handled client-side in the transformer.
  const url =
    resourceType === "Patient"
      ? `${FHIR_BASE}/Patient/${patientId}`
      : `${FHIR_BASE}/${resourceType}?${paramName}=${patientId}&_count=100`;

  return fetchWithRetry(url);
}

/**
 * Fetch with basic retry logic for flaky sandboxes.
 */
async function fetchWithRetry(
  url: string,
  retries = 3,
  backoff = 1000,
): Promise<FHIRResource[]> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/fhir+json",
          "User-Agent": "PatientAnalyst/1.0.0 (Electron; ClinicalAssistant)",
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.resourceType === "Bundle") {
          return data.entry?.map((e: any) => e.resource) ?? [];
        }
        return [data];
      }

      if (response.status >= 500) {
        console.warn(
          `[FHIR] Server error ${response.status} for ${url}. Retry ${i + 1}/${retries}...`,
        );
        await new Promise((resolve) => setTimeout(resolve, backoff * (i + 1)));
        continue;
      }

      // For client errors (4xx) — log so silent failures are visible, then return empty
      console.warn(
        `[FHIR] ${response.status} ${response.statusText} for ${url} — returning empty (check sort/search params)`,
      );
      return [];
    } catch (err) {
      console.error(
        `[FHIR] Network error for ${url}: ${err}. Retry ${i + 1}/${retries}...`,
      );
      await new Promise((resolve) => setTimeout(resolve, backoff * (i + 1)));
    }
  }
  // If all retries fail
  return [];
}

/**
 * Fetch patient list (basic demographics only).
 * Used for the initial patient table when no local seed is available.
 */
export async function fetchPatientList(count = 20): Promise<FHIRResource[]> {
  let url = `${FHIR_BASE}/Patient?_count=${count}&_sort=-_lastUpdated`;
  const collected: FHIRResource[] = [];

  while (collected.length < count && url) {
    const response = await fetch(url, {
      headers: { Accept: "application/fhir+json" },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const entries = data.entry?.map((e: any) => e.resource) ?? [];
    collected.push(...entries);

    // Check for a 'next' link to paginate
    const nextLink = data.link?.find((l: any) => l.relation === "next");
    url = nextLink ? nextLink.url : null;
  }

  return collected.slice(0, count);
}

/**
 * Fetch a single patient resource directly (demographics + meta only).
 * Used for sync intelligence pre-checks.
 */
export async function fetchPatientMetadata(
  patientId: string,
): Promise<FHIRResource | null> {
  const url = `${FHIR_BASE}/Patient/${patientId}`;
  const results = await fetchWithRetry(url);
  return results[0] ?? null;
}

/**
 * Clear the session cache (e.g., on logout or manual refresh).
 */
export function clearFHIRCache(): void {
  bundleCache.clear();
  console.log("[FHIR] Cache cleared");
}
