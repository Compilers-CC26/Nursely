-- ============================================================
-- Patient Analyst — Snowflake Schema
-- Option B: Live sync-on-select from FHIR
-- ============================================================

-- Use your configured database/schema
-- CREATE DATABASE IF NOT EXISTS PATIENT_ANALYST;
-- CREATE SCHEMA IF NOT EXISTS PATIENT_ANALYST.PUBLIC;

-- ────────────────────────────────────────────────────────────
-- 1. PATIENTS (core demographics + risk)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patients (
    patient_id          VARCHAR(64)   PRIMARY KEY,
    name                VARCHAR(200)  NOT NULL,
    age                 INT,
    sex                 VARCHAR(10),
    room                VARCHAR(20),
    mrn                 VARCHAR(50),
    diagnosis           VARCHAR(500),
    summary             VARCHAR(2000),
    risk_score          FLOAT,
    -- FHIR trace fields
    fhir_resource_id    VARCHAR(200),
    fhir_last_updated   TIMESTAMP_NTZ,
    source_system       VARCHAR(50)   DEFAULT 'SyntheaFHIR',
    -- Metadata
    created_at          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    updated_at          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ────────────────────────────────────────────────────────────
-- 2. ALLERGIES
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS allergies (
    allergy_id          VARCHAR(64)   PRIMARY KEY,
    patient_id          VARCHAR(64)   NOT NULL REFERENCES patients(patient_id),
    allergen            VARCHAR(500)  NOT NULL,
    reaction            VARCHAR(500),
    severity            VARCHAR(50),
    -- FHIR trace
    fhir_resource_type  VARCHAR(50)   DEFAULT 'AllergyIntolerance',
    fhir_resource_id    VARCHAR(200),
    fhir_last_updated   TIMESTAMP_NTZ,
    source_system       VARCHAR(50)   DEFAULT 'SyntheaFHIR',
    created_at          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ────────────────────────────────────────────────────────────
-- 3. MEDICATIONS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medications (
    medication_id       VARCHAR(64)   PRIMARY KEY,
    patient_id          VARCHAR(64)   NOT NULL REFERENCES patients(patient_id),
    medication          VARCHAR(500)  NOT NULL,
    status              VARCHAR(50),
    dosage              VARCHAR(200),
    route               VARCHAR(100),
    frequency           VARCHAR(200),
    -- FHIR trace
    fhir_resource_type  VARCHAR(50)   DEFAULT 'MedicationRequest',
    fhir_resource_id    VARCHAR(200),
    fhir_last_updated   TIMESTAMP_NTZ,
    source_system       VARCHAR(50)   DEFAULT 'SyntheaFHIR',
    created_at          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ────────────────────────────────────────────────────────────
-- 4. LAB RESULTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lab_results (
    lab_id              VARCHAR(64)   PRIMARY KEY,
    patient_id          VARCHAR(64)   NOT NULL REFERENCES patients(patient_id),
    lab_name            VARCHAR(200)  NOT NULL,
    value               VARCHAR(100),
    unit                VARCHAR(50),
    flag                VARCHAR(20),   -- 'normal','high','low','critical'
    effective_dt        TIMESTAMP_NTZ,
    -- FHIR trace
    fhir_resource_type  VARCHAR(50)   DEFAULT 'Observation',
    fhir_resource_id    VARCHAR(200),
    fhir_last_updated   TIMESTAMP_NTZ,
    source_system       VARCHAR(50)   DEFAULT 'SyntheaFHIR',
    created_at          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ────────────────────────────────────────────────────────────
-- 5. VITALS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vitals (
    vital_id            VARCHAR(64)   PRIMARY KEY,
    patient_id          VARCHAR(64)   NOT NULL REFERENCES patients(patient_id),
    hr                  FLOAT,
    bp_sys              FLOAT,
    bp_dia              FLOAT,
    rr                  FLOAT,
    temp                FLOAT,
    spo2                FLOAT,
    effective_dt        TIMESTAMP_NTZ,
    -- FHIR trace
    fhir_resource_type  VARCHAR(50)   DEFAULT 'Observation',
    fhir_resource_id    VARCHAR(200),
    fhir_last_updated   TIMESTAMP_NTZ,
    source_system       VARCHAR(50)   DEFAULT 'SyntheaFHIR',
    created_at          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ────────────────────────────────────────────────────────────
-- 6. NURSING NOTES
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nursing_notes (
    note_id             VARCHAR(64)   PRIMARY KEY,
    patient_id          VARCHAR(64)   NOT NULL REFERENCES patients(patient_id),
    note_text           VARCHAR(10000),
    author              VARCHAR(200),
    note_dt             TIMESTAMP_NTZ,
    -- FHIR trace
    fhir_resource_type  VARCHAR(50)   DEFAULT 'DocumentReference',
    fhir_resource_id    VARCHAR(200),
    fhir_last_updated   TIMESTAMP_NTZ,
    source_system       VARCHAR(50)   DEFAULT 'SyntheaFHIR',
    created_at          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ────────────────────────────────────────────────────────────
-- 7. PATIENT SNAPSHOTS (sync tracking + completeness)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patient_snapshots (
    snapshot_id         VARCHAR(64)   PRIMARY KEY,
    patient_id          VARCHAR(64)   NOT NULL REFERENCES patients(patient_id),
    snapshot_at         TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    lookback_hours      INT           DEFAULT 72,
    completeness_flags  VARIANT,      -- JSON: { "missing_labs": [...], "stale_vitals": true }
    resource_counts     VARIANT       -- JSON: { "allergies": 2, "meds": 5, ... }
);

-- ────────────────────────────────────────────────────────────
-- 8. KNOWLEDGE BASE (hospital docs for Cortex Search RAG)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS knowledge_base (
    doc_id              VARCHAR(64)   PRIMARY KEY,
    source_title        VARCHAR(500)  NOT NULL,
    content             VARCHAR(16000) NOT NULL,
    category            VARCHAR(100),   -- 'protocol','policy','formulary','guideline'
    policy_id           VARCHAR(100),
    version             VARCHAR(20),
    published_date      DATE,
    -- Metadata
    created_at          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ────────────────────────────────────────────────────────────
-- 9. FHIR RAW (traceability / debug store)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fhir_raw (
    raw_id              VARCHAR(64)   PRIMARY KEY,
    patient_id          VARCHAR(64)   NOT NULL,
    resource_type       VARCHAR(50),
    raw_json            VARIANT,
    ingested_at         TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ────────────────────────────────────────────────────────────
-- INDEXES for query performance
-- ────────────────────────────────────────────────────────────
-- Snowflake auto-clusters, but explicit clustering helps:
ALTER TABLE lab_results CLUSTER BY (patient_id, effective_dt);
ALTER TABLE vitals CLUSTER BY (patient_id, effective_dt);
ALTER TABLE nursing_notes CLUSTER BY (patient_id, note_dt);
