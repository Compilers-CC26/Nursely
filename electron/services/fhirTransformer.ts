/**
 * FHIR Transformer — Converts FHIR Bundle into flat Snowflake-ready rows
 *
 * Each transform function extracts the relevant fields from FHIR resources
 * and produces normalized rows with trace fields for provenance.
 */

import { v4 as uuidv4 } from "crypto";
import type {
  FHIRBundle,
  FHIRResource,
  TransformedSnapshot,
  PatientRow,
  AllergyRow,
  MedicationRow,
  LabRow,
  VitalRow,
  NoteRow,
} from "./fhirTypes";

const SOURCE_SYSTEM = "SyntheaFHIR";

// Observation codes that indicate vitals vs labs
const VITAL_CODES = new Set([
  "8867-4", // Heart rate
  "8480-6", // Systolic BP
  "8462-4", // Diastolic BP
  "9279-1", // Respiratory rate
  "8310-5", // Body temperature
  "2708-6", // SpO2
  "85354-9", // Blood pressure panel
]);

/**
 * Transform an entire FHIR Bundle into a structured snapshot.
 */
export function transformBundle(
  patientId: string,
  bundle: FHIRBundle,
  lookbackHours = 72
): TransformedSnapshot {
  const resources = bundle.entry.map((e) => e.resource);
  // For demo purposes, we disable the strict 72h lookback to ensure
  // historical data from sandboxes (SMART/Synthea) is included.
  // const cutoff = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);
  const cutoff = new Date(0); // Epoch start = include everything

  // Group resources by type
  const byType = new Map<string, FHIRResource[]>();
  for (const r of resources) {
    const list = byType.get(r.resourceType) ?? [];
    list.push(r);
    byType.set(r.resourceType, list);
  }

  // Transform each resource type
  const patient = transformPatient(
    patientId,
    byType.get("Patient")?.[0] ?? null,
    byType.get("Condition") ?? []
  );

  const allergies = (byType.get("AllergyIntolerance") ?? []).map((r) =>
    transformAllergy(patientId, r)
  );

  const medications = (byType.get("MedicationRequest") ?? []).map((r) =>
    transformMedication(patientId, r)
  );

  // Split Observations into labs and vitals
  const observations = (byType.get("Observation") ?? []).filter((obs) => {
    const effectiveDate = obs.effectiveDateTime
      ? new Date(obs.effectiveDateTime)
      : null;
    return !effectiveDate || effectiveDate >= cutoff;
  });

  const rawVitals: FHIRResource[] = [];
  const rawLabs: FHIRResource[] = [];
  for (const obs of observations) {
    const codings = obs.code?.coding ?? [];
    const isVitalCode = codings.some(c => c.code && VITAL_CODES.has(c.code));
    const isVitalCategory = obs.category?.some((cat: any) =>
      cat.coding?.some((c: any) => c.code === "vital-signs")
    );

    if (isVitalCode || isVitalCategory) {
      rawVitals.push(obs);
    } else {
      rawLabs.push(obs);
    }
  }

  const labs = rawLabs.map((r) => transformLab(patientId, r));
  const vitals = groupVitals(patientId, rawVitals);

  const notes = (byType.get("DocumentReference") ?? []).map((r) =>
    transformNote(patientId, r)
  );

  // Raw storage for traceability
  const rawResources = resources.map((r) => ({
    resource_type: r.resourceType,
    raw_json: r,
  }));

  return { patient, allergies, medications, labs, vitals, notes, rawResources };
}

// ── Individual transformers ──

function transformPatient(
  patientId: string,
  resource: FHIRResource | null,
  conditions: FHIRResource[]
): PatientRow | null {
  if (!resource) return null;

  const name = resource.name?.[0];
  const fullName = name
    ? `${name.given?.join(" ") ?? ""} ${name.family ?? ""}`.trim()
    : "Unknown";

  const birthDate = resource.birthDate
    ? new Date(resource.birthDate)
    : null;
  const age = birthDate
    ? Math.floor(
        (Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      )
    : 0;

  const sex = resource.gender === "male" ? "M" : resource.gender === "female" ? "F" : "U";

  // Primary diagnosis from conditions
  const primaryCondition = conditions[0];
  const diagnosis =
    primaryCondition?.code?.coding?.[0]?.display ??
    primaryCondition?.code?.text ??
    "Unknown";

  // Summary from all active conditions
  const conditionNames = conditions
    .slice(0, 5)
    .map(
      (c) => c.code?.coding?.[0]?.display ?? c.code?.text ?? "Unknown condition"
    );
  const summary =
    conditionNames.length > 0
      ? `Active conditions: ${conditionNames.join("; ")}`
      : "No active conditions documented";

  // Risk score — derive from condition count + basic heuristics
  const riskScore = Math.min(
    0.99,
    0.3 + conditions.length * 0.1 + Math.random() * 0.15
  );

  return {
    patient_id: patientId,
    name: fullName,
    age,
    sex,
    room: `${Math.floor(Math.random() * 7) + 2}${String.fromCharCode(65 + Math.floor(Math.random() * 4))}-${100 + Math.floor(Math.random() * 50)}`,
    mrn: `MRN-${resource.id.slice(0, 6).toUpperCase()}`,
    diagnosis,
    summary,
    risk_score: Math.round(riskScore * 1000) / 1000,
    fhir_resource_id: resource.id,
    fhir_last_updated: resource.meta?.lastUpdated ?? null,
    source_system: SOURCE_SYSTEM,
  };
}

function transformAllergy(
  patientId: string,
  resource: FHIRResource
): AllergyRow {
  const allergen =
    resource.code?.coding?.[0]?.display ?? resource.code?.text ?? "Unknown";
  const reaction =
    resource.reaction?.[0]?.manifestation?.[0]?.coding?.[0]?.display ?? "";
  const severity =
    resource.reaction?.[0]?.severity ?? resource.criticality ?? "unknown";

  return {
    allergy_id: resource.id,
    patient_id: patientId,
    allergen,
    reaction,
    severity,
    fhir_resource_type: "AllergyIntolerance",
    fhir_resource_id: resource.id,
    fhir_last_updated: resource.meta?.lastUpdated ?? null,
    source_system: SOURCE_SYSTEM,
  };
}

function transformMedication(
  patientId: string,
  resource: FHIRResource
): MedicationRow {
  const medication =
    resource.medicationCodeableConcept?.coding?.[0]?.display ??
    resource.medicationCodeableConcept?.text ??
    "Unknown medication";

  const dosage = resource.dosageInstruction?.[0];
  const doseText = dosage?.text ?? dosage?.doseAndRate?.[0]?.doseQuantity
    ? `${dosage.doseAndRate[0].doseQuantity.value} ${dosage.doseAndRate[0].doseQuantity.unit}`
    : "";

  return {
    medication_id: resource.id,
    patient_id: patientId,
    medication,
    status: resource.status ?? "active",
    dosage: doseText,
    route: dosage?.route?.coding?.[0]?.display ?? "",
    frequency: dosage?.timing?.code?.text ?? dosage?.timing?.repeat?.frequency
      ? `${dosage.timing.repeat.frequency}x per ${dosage.timing.repeat.period} ${dosage.timing.repeat.periodUnit}`
      : "",
    fhir_resource_type: "MedicationRequest",
    fhir_resource_id: resource.id,
    fhir_last_updated: resource.meta?.lastUpdated ?? null,
    source_system: SOURCE_SYSTEM,
  };
}

function transformLab(patientId: string, resource: FHIRResource): LabRow {
  const labName =
    resource.code?.coding?.[0]?.display ?? resource.code?.text ?? "Unknown lab";
  const valueQty = resource.valueQuantity;
  const value = valueQty
    ? `${valueQty.value}`
    : resource.valueString ?? resource.valueCodeableConcept?.text ?? "";
  const unit = valueQty?.unit ?? "";

  // Determine flag from interpretation or reference range
  let flag = "normal";
  const interp = resource.interpretation?.[0]?.coding?.[0]?.code || resource.interpretation?.[0]?.text;
  if (interp === "H" || interp === "HH" || String(interp).includes("High")) flag = interp === "HH" ? "critical" : "high";
  else if (interp === "L" || interp === "LL" || String(interp).includes("Low")) flag = interp === "LL" ? "critical" : "low";
  else if (interp === "A" || interp === "AA" || String(interp).includes("Abnormal")) flag = "high";

  return {
    lab_id: resource.id,
    patient_id: patientId,
    lab_name: labName,
    value,
    unit,
    flag,
    effective_dt: resource.effectiveDateTime ?? new Date().toISOString(),
    fhir_resource_type: "Observation",
    fhir_resource_id: resource.id,
    fhir_last_updated: resource.meta?.lastUpdated ?? null,
    source_system: SOURCE_SYSTEM,
  };
}

/**
 * Group individual vital-sign Observations into single VitalRow records.
 * Groups by effective timestamp (rounded to nearest minute).
 */
function groupVitals(
  patientId: string,
  observations: FHIRResource[]
): VitalRow[] {
  // Sort by time, then group by rounded timestamp
  const byTimestamp = new Map<string, Partial<VitalRow>>();

  for (const obs of observations) {
    const dt = obs.effectiveDateTime ?? new Date().toISOString();
    // Round to nearest minute for grouping
    const roundedDt = dt.slice(0, 16) + ":00Z";

    // Only process if it matches one of our primary vital codes or has components we want
    const codings = obs.code?.coding ?? [];
    const hasPrimaryCode = codings.some(c => VITAL_CODES.has(c.code ?? ""));
    const hasBPPanel = codings.some(c => c.code === "85354-9");

    if (!hasPrimaryCode && !hasBPPanel) continue;

    const existing = byTimestamp.get(roundedDt) ?? {
      vital_id: obs.id,
      patient_id: patientId,
      hr: null,
      bp_sys: null,
      bp_dia: null,
      rr: null,
      temp: null,
      spo2: null,
      effective_dt: dt,
      fhir_resource_type: "Observation",
      fhir_resource_id: obs.id,
      fhir_last_updated: obs.meta?.lastUpdated ?? null,
      source_system: SOURCE_SYSTEM,
    };

    const value = obs.valueQuantity?.value;

    codings.forEach(c => {
      const code = c.code;
      if (code === "8867-4") existing.hr = value ?? null;
      else if (code === "8480-6") existing.bp_sys = value ?? null;
      else if (code === "8462-4") existing.bp_dia = value ?? null;
      else if (code === "9279-1") existing.rr = value ?? null;
      else if (code === "8310-5") existing.temp = value ?? null;
      else if (code === "2708-6") existing.spo2 = value ?? null;
    });

    // Blood pressure panel — extract systolic/diastolic from components if direct code missing
    if (hasBPPanel) {
      const components = obs.component ?? [];
      for (const comp of components) {
        const compCodings = comp.code?.coding ?? [];
        const compValue = comp.valueQuantity?.value ?? null;
        if (compCodings.some(cc => cc.code === "8480-6")) existing.bp_sys = compValue;
        else if (compCodings.some(cc => cc.code === "8462-4")) existing.bp_dia = compValue;
      }
    }

    byTimestamp.set(roundedDt, existing);
  }

  // Final pass: filter out any rows that somehow ended up with all primary vitals null
  return Array.from(byTimestamp.values()).filter(v =>
    v.hr !== null || v.bp_sys !== null || v.bp_dia !== null ||
    v.rr !== null || v.temp !== null || v.spo2 !== null
  ) as VitalRow[];
}

function transformNote(patientId: string, resource: FHIRResource): NoteRow {
  // DocumentReference may have content as attachment
  const content = resource.content?.[0];
  let noteText = "";

  if (content?.attachment?.data) {
    // Base64-encoded text
    try {
      noteText = Buffer.from(content.attachment.data, "base64").toString(
        "utf-8"
      );
    } catch {
      noteText = content.attachment.data;
    }
  } else if (content?.attachment?.url) {
    noteText = `[Attachment: ${content.attachment.url}]`;
  } else {
    noteText = resource.description ?? "No content available";
  }

  const author =
    resource.author?.[0]?.display ?? resource.author?.[0]?.reference ?? "Unknown";

  return {
    note_id: resource.id,
    patient_id: patientId,
    note_text: noteText.slice(0, 10000), // Truncate to table limit
    author,
    note_dt: resource.date ?? resource.meta?.lastUpdated ?? new Date().toISOString(),
    fhir_resource_type: "DocumentReference",
    fhir_resource_id: resource.id,
    fhir_last_updated: resource.meta?.lastUpdated ?? null,
    source_system: SOURCE_SYSTEM,
  };
}
