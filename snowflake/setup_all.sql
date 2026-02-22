-- ============================================================
-- Patient Analyst — BULLETPROOF SETUP (Run All at once)
-- ============================================================

-- 1. INFRASTRUCTURE (Using your existing COMPUTE_WH)
USE ROLE ACCOUNTADMIN;
CREATE DATABASE IF NOT EXISTS PATIENT_ANALYST;
USE DATABASE PATIENT_ANALYST;
CREATE SCHEMA IF NOT EXISTS PUBLIC;
USE SCHEMA PUBLIC;
USE WAREHOUSE COMPUTE_WH;

-- 2. CREATE TABLES (Atomic Create or Replace)
CREATE OR REPLACE TABLE patients (
    patient_id          VARCHAR(64)   PRIMARY KEY,
    name                VARCHAR(200)  NOT NULL,
    age                 INT,
    sex                 VARCHAR(10),
    room                VARCHAR(20),
    mrn                 VARCHAR(50),
    diagnosis           VARCHAR(500),
    summary             VARCHAR(2000),
    risk_score          FLOAT,
    fhir_resource_id    VARCHAR(200),
    fhir_last_updated   TIMESTAMP_NTZ,
    source_system       VARCHAR(50)   DEFAULT 'SyntheaFHIR',
    created_at          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    updated_at          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE OR REPLACE TABLE allergies (
    allergy_id          VARCHAR(64)   PRIMARY KEY,
    patient_id          VARCHAR(64)   NOT NULL REFERENCES patients(patient_id),
    allergen            VARCHAR(500)  NOT NULL,
    reaction            VARCHAR(500),
    severity            VARCHAR(50),
    fhir_resource_type  VARCHAR(50)   DEFAULT 'AllergyIntolerance',
    fhir_resource_id    VARCHAR(200),
    fhir_last_updated   TIMESTAMP_NTZ,
    source_system       VARCHAR(50)   DEFAULT 'SyntheaFHIR',
    created_at          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE OR REPLACE TABLE medications (
    medication_id       VARCHAR(64)   PRIMARY KEY,
    patient_id          VARCHAR(64)   NOT NULL REFERENCES patients(patient_id),
    medication          VARCHAR(500)  NOT NULL,
    status              VARCHAR(50),
    dosage              VARCHAR(200),
    route               VARCHAR(100),
    frequency           VARCHAR(200),
    fhir_resource_type  VARCHAR(50)   DEFAULT 'MedicationRequest',
    fhir_resource_id    VARCHAR(200),
    fhir_last_updated   TIMESTAMP_NTZ,
    source_system       VARCHAR(50)   DEFAULT 'SyntheaFHIR',
    created_at          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE OR REPLACE TABLE lab_results (
    lab_id              VARCHAR(64)   PRIMARY KEY,
    patient_id          VARCHAR(64)   NOT NULL REFERENCES patients(patient_id),
    lab_name            VARCHAR(200)  NOT NULL,
    value               VARCHAR(100),
    unit                VARCHAR(50),
    flag                VARCHAR(20),
    effective_dt        TIMESTAMP_NTZ,
    fhir_resource_type  VARCHAR(50)   DEFAULT 'Observation',
    fhir_resource_id    VARCHAR(200),
    fhir_last_updated   TIMESTAMP_NTZ,
    source_system       VARCHAR(50)   DEFAULT 'SyntheaFHIR',
    created_at          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE OR REPLACE TABLE vitals (
    vital_id            VARCHAR(64)   PRIMARY KEY,
    patient_id          VARCHAR(64)   NOT NULL REFERENCES patients(patient_id),
    hr                  FLOAT,
    bp_sys              FLOAT,
    bp_dia              FLOAT,
    rr                  FLOAT,
    temp                FLOAT,
    spo2                FLOAT,
    effective_dt        TIMESTAMP_NTZ,
    fhir_resource_type  VARCHAR(50)   DEFAULT 'Observation',
    fhir_resource_id    VARCHAR(200),
    fhir_last_updated   TIMESTAMP_NTZ,
    source_system       VARCHAR(50)   DEFAULT 'SyntheaFHIR',
    created_at          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE OR REPLACE TABLE nursing_notes (
    note_id             VARCHAR(64)   PRIMARY KEY,
    patient_id          VARCHAR(64)   NOT NULL REFERENCES patients(patient_id),
    note_text           VARCHAR(10000),
    author              VARCHAR(200),
    note_dt             TIMESTAMP_NTZ,
    fhir_resource_type  VARCHAR(50)   DEFAULT 'DocumentReference',
    fhir_resource_id    VARCHAR(200),
    fhir_last_updated   TIMESTAMP_NTZ,
    source_system       VARCHAR(50)   DEFAULT 'SyntheaFHIR',
    created_at          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE OR REPLACE TABLE patient_snapshots (
    snapshot_id         VARCHAR(64)   PRIMARY KEY,
    patient_id          VARCHAR(64)   NOT NULL REFERENCES patients(patient_id),
    snapshot_at         TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    lookback_hours      INT           DEFAULT 72,
    completeness_flags  VARIANT,
    resource_counts     VARIANT
);

CREATE OR REPLACE TABLE knowledge_base (
    doc_id              VARCHAR(64)   PRIMARY KEY,
    source_title        VARCHAR(500)  NOT NULL,
    content             VARCHAR(16000) NOT NULL,
    category            VARCHAR(100),
    policy_id           VARCHAR(100),
    version             VARCHAR(20),
    published_date      DATE,
    created_at          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE OR REPLACE TABLE fhir_raw (
    raw_id              VARCHAR(64)   PRIMARY KEY,
    patient_id          VARCHAR(64)   NOT NULL,
    resource_type       VARCHAR(50),
    raw_json            VARIANT,
    ingested_at         TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- 3. SEED KNOWLEDGE BASE
INSERT INTO knowledge_base (doc_id, source_title, content, category, policy_id, version, published_date)
VALUES
('KB-001', 'SEP-1 Early Management Bundle', 'PURPOSE: Early identification and treatment of sepsis to reduce mortality. CRITERIA: Suspected infection AND 2+ SIRS or qSOFA score >= 2.', 'protocol', 'SEP-001', '4.2', '2024-01-15'),
('KB-002', 'Fall Prevention Protocol', 'PURPOSE: Reduce preventable falls. ACTIONS: Fall risk assessment every shift, bed alarms, skid-proof socks, hourly rounding.', 'protocol', 'FALL-001', '3.1', '2024-03-01'),
('KB-003', 'Pain Management Standards', 'PURPOSE: Standardized pain assessment. TOOL: Numeric rating scale (0-10) or CPOT for non-verbal. Re-assess 60 min after IV meds.', 'guideline', 'PAIN-001', '2.5', '2024-02-15'),
('KB-004', 'RRT Activation Criteria', 'PURPOSE: Emergency intervention. CRITERIA: Acute change in HR <40 or >130, SBP <90, RR <10 or >28, SpO2 <90% despite O2.', 'protocol', 'RRT-001', '5.0', '2024-01-01'),
('KB-005', 'Medication Administration Safety', 'PURPOSE: Prevent errors. FIVE RIGHTS: Patient, Medication, Dose, Route, Time. Two-nurse verification required for insulin/heparin.', 'policy', 'MEDSAFE-001', '6.0', '2024-04-01'),
('KB-006', 'Code Blue Response', 'PURPOSE: Arrest protocol. ACTIONS: Confirm pulselessness, call code, start chest compressions (100-120/min), apply AED.', 'protocol', 'CODE-001', '7.0', '2024-02-01'),
('KB-007', 'Infection Prevention', 'PURPOSE: Hygiene compliance. STANDARDS: Hand hygiene before/after patient contact. Standard precautions for all patients.', 'policy', 'IC-001', '3.0', '2024-05-01'),
('KB-008', 'Blood Transfusion Protocol', 'PURPOSE: Safe administration. ACTIONS: Two-person check at bedside, baseline vitals, remain with patient first 15 mins.', 'protocol', 'BLOOD-001', '4.0', '2024-03-15'),
('KB-009', 'Pressure Injury Prevention', 'PURPOSE: Skin integrity. ACTIONS: Turn every 2 hours, use foam dressings on bony prominences, optimize nutrition.', 'guideline', 'SKIN-001', '2.0', '2024-06-01'),
('KB-010', 'Discharge Planning', 'PURPOSE: Care transition. STANDARDS: Medication reconciliation, follow-up appointment verification, patient education confirmed.', 'policy', 'DC-001', '3.5', '2024-04-15');

-- 4. CORTEX SEARCH SERVICE (Fixed identifier context)
CREATE OR REPLACE CORTEX SEARCH SERVICE knowledge_search
  ON content
  ATTRIBUTES source_title, category, policy_id, version
  WAREHOUSE = COMPUTE_WH
  TARGET_LAG = '1 hour'
  AS (
    SELECT
      doc_id,
      content,
      source_title,
      category,
      policy_id,
      version
    FROM knowledge_base
  );

-- 5. RAG STORED PROCEDURE
CREATE OR REPLACE PROCEDURE process_nurse_query(
    p_patient_id VARCHAR,
    p_question VARCHAR
)
RETURNS VARIANT
LANGUAGE SQL
AS
$$
DECLARE
    v_patient_context VARCHAR;
    v_snapshot_at TIMESTAMP_NTZ;
    v_completeness VARIANT;
    v_search_results VARIANT;
    v_prompt VARCHAR;
    v_answer VARCHAR;
    v_result VARIANT;
BEGIN
    SELECT snapshot_at, completeness_flags
    INTO :v_snapshot_at, :v_completeness
    FROM patient_snapshots
    WHERE patient_id = :p_patient_id
    ORDER BY snapshot_at DESC
    LIMIT 1;

    SELECT LISTAGG(line, '\n') WITHIN GROUP (ORDER BY section_order)
    INTO :v_patient_context
    FROM (
        SELECT 1 AS section_order, 'PATIENT: ' || name || ', ' || age || 'yo ' || sex || ', Diagnosis: ' || COALESCE(diagnosis, 'Unknown') AS line
        FROM patients WHERE patient_id = :p_patient_id
        UNION ALL
        SELECT 2, 'ALLERGIES: ' || COALESCE(LISTAGG(allergen, ', '), 'NKDA')
        FROM allergies WHERE patient_id = :p_patient_id
        UNION ALL
        SELECT 3, 'MEDICATIONS: ' || COALESCE(LISTAGG(medication, ', '), 'None documented')
        FROM medications WHERE patient_id = :p_patient_id
        UNION ALL
        SELECT 4, 'LATEST VITALS: HR=' || COALESCE(TO_VARCHAR(hr), '?') FROM vitals WHERE patient_id = :p_patient_id ORDER BY effective_dt DESC LIMIT 1
    );

    v_search_results := (SELECT SNOWFLAKE.CORTEX.SEARCH_PREVIEW('knowledge_search', :p_question, 3));

    v_prompt := 'Patient Data: ' || COALESCE(:v_patient_context, 'No records.') ||
                '\n\nProtocols: ' || TO_VARCHAR(:v_search_results) ||
                '\n\nQuestion: ' || :p_question;

    v_answer := (SELECT SNOWFLAKE.CORTEX.COMPLETE('mistral-large', :v_prompt));

    v_result := OBJECT_CONSTRUCT('answer', :v_answer, 'data_as_of', :v_snapshot_at, 'completeness_flags', :v_completeness);
    RETURN :v_result;
EXCEPTION
    WHEN OTHER THEN
        RETURN OBJECT_CONSTRUCT('answer', 'AI Error: ' || SQLERRM, 'data_as_of', CURRENT_TIMESTAMP());
END;
$$;
