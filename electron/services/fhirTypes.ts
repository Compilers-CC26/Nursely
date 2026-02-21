/**
 * FHIR Type Definitions
 *
 * Minimal types for the subset of FHIR R4 resources we consume.
 * Not exhaustive — only covers fields we transform.
 */

export interface FHIRResource {
  resourceType: string;
  id: string;
  meta?: {
    lastUpdated?: string;
    versionId?: string;
  };
  [key: string]: any;
}

export interface FHIRBundle {
  resourceType: "Bundle";
  type: string;
  total: number;
  entry: FHIRBundleEntry[];
}

export interface FHIRBundleEntry {
  resource: FHIRResource;
  fullUrl?: string;
}

// ── Transformed row types (ready for Snowflake upsert) ──

export interface PatientRow {
  patient_id: string;
  name: string;
  age: number;
  sex: string;
  room: string;
  mrn: string;
  diagnosis: string;
  summary: string;
  risk_score: number;
  fhir_resource_id: string;
  fhir_last_updated: string | null;
  source_system: string;
}

export interface AllergyRow {
  allergy_id: string;
  patient_id: string;
  allergen: string;
  reaction: string;
  severity: string;
  fhir_resource_type: string;
  fhir_resource_id: string;
  fhir_last_updated: string | null;
  source_system: string;
}

export interface MedicationRow {
  medication_id: string;
  patient_id: string;
  medication: string;
  status: string;
  dosage: string;
  route: string;
  frequency: string;
  fhir_resource_type: string;
  fhir_resource_id: string;
  fhir_last_updated: string | null;
  source_system: string;
}

export interface LabRow {
  lab_id: string;
  patient_id: string;
  lab_name: string;
  value: string;
  unit: string;
  flag: string;
  effective_dt: string;
  fhir_resource_type: string;
  fhir_resource_id: string;
  fhir_last_updated: string | null;
  source_system: string;
}

export interface VitalRow {
  vital_id: string;
  patient_id: string;
  hr: number | null;
  bp_sys: number | null;
  bp_dia: number | null;
  rr: number | null;
  temp: number | null;
  spo2: number | null;
  effective_dt: string;
  fhir_resource_type: string;
  fhir_resource_id: string;
  fhir_last_updated: string | null;
  source_system: string;
}

export interface NoteRow {
  note_id: string;
  patient_id: string;
  note_text: string;
  author: string;
  note_dt: string;
  fhir_resource_type: string;
  fhir_resource_id: string;
  fhir_last_updated: string | null;
  source_system: string;
}

export interface TransformedSnapshot {
  patient: PatientRow | null;
  allergies: AllergyRow[];
  medications: MedicationRow[];
  labs: LabRow[];
  vitals: VitalRow[];
  notes: NoteRow[];
  rawResources: Array<{ resource_type: string; raw_json: any }>;
}
