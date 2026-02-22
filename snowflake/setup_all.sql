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
    patient_id          VARCHAR(128)   PRIMARY KEY,
    name                VARCHAR(200)  NOT NULL,
    age                 INT,
    sex                 VARCHAR(1),
    room                VARCHAR(20),
    mrn                 VARCHAR(50),
    diagnosis           VARCHAR(500),
    summary             VARCHAR(2000),
    risk_score          FLOAT,
    fhir_resource_id    VARCHAR(128),
    fhir_last_updated   TIMESTAMP_NTZ,
    source_system       VARCHAR(50)   DEFAULT 'SyntheaFHIR',
    created_at          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    updated_at          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE OR REPLACE TABLE allergies (
    allergy_id          VARCHAR(128)   PRIMARY KEY,
    patient_id          VARCHAR(128)   NOT NULL REFERENCES patients(patient_id),
    allergen            VARCHAR(200)  NOT NULL,
    reaction            VARCHAR(500),
    severity            VARCHAR(50),
    fhir_resource_type  VARCHAR(100)   DEFAULT 'AllergyIntolerance',
    fhir_resource_id    VARCHAR(128),
    fhir_last_updated   TIMESTAMP_NTZ,
    source_system       VARCHAR(50)   DEFAULT 'SyntheaFHIR',
    created_at          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE OR REPLACE TABLE medications (
    medication_id       VARCHAR(128)   PRIMARY KEY,
    patient_id          VARCHAR(128)   NOT NULL REFERENCES patients(patient_id),
    medication          VARCHAR(200)  NOT NULL,
    status              VARCHAR(50),
    dosage              VARCHAR(500),
    route               VARCHAR(100),
    frequency           VARCHAR(200),
    fhir_resource_type  VARCHAR(100)   DEFAULT 'MedicationRequest',
    fhir_resource_id    VARCHAR(128),
    fhir_last_updated   TIMESTAMP_NTZ,
    source_system       VARCHAR(50)   DEFAULT 'SyntheaFHIR',
    created_at          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE OR REPLACE TABLE lab_results (
    lab_id              VARCHAR(128)   PRIMARY KEY,
    patient_id          VARCHAR(128)   NOT NULL REFERENCES patients(patient_id),
    lab_name            VARCHAR(200)  NOT NULL,
    value               VARCHAR(100),
    unit                VARCHAR(50),
    flag                VARCHAR(20),
    effective_dt        TIMESTAMP_NTZ,
    fhir_resource_type  VARCHAR(100)   DEFAULT 'Observation',
    fhir_resource_id    VARCHAR(128),
    fhir_last_updated   TIMESTAMP_NTZ,
    source_system       VARCHAR(50)   DEFAULT 'SyntheaFHIR',
    created_at          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE OR REPLACE TABLE vitals (
    vital_id            VARCHAR(128)   PRIMARY KEY,
    patient_id          VARCHAR(128)   NOT NULL REFERENCES patients(patient_id),
    hr                  FLOAT,
    bp_sys              FLOAT,
    bp_dia              FLOAT,
    rr                  FLOAT,
    temp                FLOAT,
    spo2                FLOAT,
    effective_dt        TIMESTAMP_NTZ,
    fhir_resource_type  VARCHAR(100)   DEFAULT 'Observation',
    fhir_resource_id    VARCHAR(128),
    fhir_last_updated   TIMESTAMP_NTZ,
    source_system       VARCHAR(50)   DEFAULT 'SyntheaFHIR',
    created_at          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE OR REPLACE TABLE nursing_notes (
    note_id             VARCHAR(128)   PRIMARY KEY,
    patient_id          VARCHAR(128)   NOT NULL REFERENCES patients(patient_id),
    note_text           VARCHAR(10000),
    author              VARCHAR(200),
    note_dt             TIMESTAMP_NTZ,
    fhir_resource_type  VARCHAR(100)   DEFAULT 'DocumentReference',
    fhir_resource_id    VARCHAR(128),
    fhir_last_updated   TIMESTAMP_NTZ,
    source_system       VARCHAR(50)   DEFAULT 'SyntheaFHIR',
    created_at          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE OR REPLACE TABLE patient_snapshots (
    snapshot_id         VARCHAR(128)   PRIMARY KEY,
    patient_id          VARCHAR(128)   NOT NULL REFERENCES patients(patient_id),
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
    raw_id              VARCHAR(256)  PRIMARY KEY,
    patient_id          VARCHAR(128)  NOT NULL,
    resource_type       VARCHAR(100),
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
    v_labs_context VARCHAR;
    v_snapshot_at TIMESTAMP_NTZ;
    v_completeness VARIANT;
    v_search_results VARIANT;
    v_search_query VARCHAR;
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

    -- Build patient context string from multiple tables using explicit scoping
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
        SELECT 4, 'LATEST VITALS: HR=' || COALESCE(TO_VARCHAR(v.hr), 'N/A') || ', BP=' || COALESCE(TO_VARCHAR(v.bp_sys), 'N/A') || '/' || COALESCE(TO_VARCHAR(v.bp_dia), 'N/A') || ', Temp=' || COALESCE(TO_VARCHAR(v.temp), 'N/A') || 'F, SpO2=' || COALESCE(TO_VARCHAR(v.spo2), 'N/A') || '%, RR=' || COALESCE(TO_VARCHAR(v.rr), 'N/A') || ' (recorded ' || COALESCE(TO_VARCHAR(v.effective_dt), 'unknown time') || ')'
        FROM (SELECT hr, bp_sys, bp_dia, rr, temp, spo2, effective_dt FROM vitals WHERE patient_id = :p_patient_id ORDER BY effective_dt DESC LIMIT 1) AS v
    );

    -- Build lab results context (most recent 15 results, flag abnormal values)
    SELECT COALESCE(
        LISTAGG(
            lab_name || ': ' || COALESCE(value, '?') ||
            CASE WHEN unit IS NOT NULL AND unit != '' THEN ' ' || unit ELSE '' END ||
            CASE WHEN UPPER(COALESCE(flag, '')) IN ('HIGH', 'LOW', 'CRITICAL', 'ABNORMAL', 'H', 'L', 'PANIC')
                 THEN ' [' || UPPER(flag) || ']' ELSE '' END,
            '; '
        ) WITHIN GROUP (ORDER BY effective_dt DESC),
        'No labs on file'
    )
    INTO :v_labs_context
    FROM (
        SELECT lab_name, value, unit, flag, effective_dt
        FROM lab_results
        WHERE patient_id = :p_patient_id
        ORDER BY effective_dt DESC
        LIMIT 15
    ) sub;

    v_patient_context := :v_patient_context || '\nLABS: ' || :v_labs_context;

    -- Extract the actual nurse question text for keyword matching
    v_search_query := COALESCE(
        NULLIF(TRIM(REGEXP_SUBSTR(:p_question, 'NURSE QUESTION:\s*(.+)', 1, 1, 'es', 1)), ''),
        RIGHT(:p_question, 200)
    );

    -- Match KB docs where any meaningful word from the question appears in content or title
    v_search_results := (
        SELECT OBJECT_CONSTRUCT('results', COALESCE(ARRAY_AGG(
            OBJECT_CONSTRUCT(
                'source_title', source_title,
                'category', category,
                'policy_id', policy_id,
                'content', content
            )
        ), ARRAY_CONSTRUCT()))
        FROM (
            SELECT DISTINCT kb.source_title, kb.category, kb.policy_id, kb.content
            FROM knowledge_base kb,
                 LATERAL STRTOK_SPLIT_TO_TABLE(:v_search_query, ' ') AS t
            WHERE LENGTH(t.value) > 3
              AND REGEXP_REPLACE(LOWER(t.value), '[^a-z0-9-]', '') != ''
              AND (
                  LOWER(kb.content) LIKE '%' || REGEXP_REPLACE(LOWER(t.value), '[^a-z0-9-]', '') || '%'
                  OR LOWER(kb.source_title) LIKE '%' || REGEXP_REPLACE(LOWER(t.value), '[^a-z0-9-]', '') || '%'
              )
            LIMIT 5
        )
    );

    v_prompt :=
        'ROLE: Clinical decision support assistant embedded in a nurse-facing EHR dashboard. ' ||
        'You assist registered nurses with point-of-care questions during active patient management.' || '\n' ||

        'RULES:\n' ||
        '- Respond in clinical language appropriate for a registered nurse.\n' ||
        '- Be concise: 3-6 sentences or a short bulleted list. No preamble or filler.\n' ||
        '- Ground every statement in the patient data provided. Do not invent findings.\n' ||
        '- If data is missing or unavailable, state it explicitly (e.g., "No recent vitals on file").\n' ||
        '- Prefix critical findings with ALERT: — abnormal vitals, high-alert medications, critical lab values.\n' ||
        '- Never diagnose. Recommend provider notification or rapid response escalation when clinically indicated.\n' ||
        '- Cite applicable protocols briefly when relevant (e.g., "Per SEP-1 bundle...").\n' ||
        '- Close with one specific, actionable next step for the nurse.\n' ||
        '- This tool supports clinical judgment; it does not replace it.\n\n' ||

        'PATIENT DATA:\n' ||
        COALESCE(:v_patient_context, 'No patient data found. Advise the nurse to verify the patient ID and consult the EHR directly.') || '\n\n' ||

        'RELEVANT PROTOCOLS:\n' ||
        TO_VARCHAR(:v_search_results) || '\n\n' ||

        'QUESTION: ' || :p_question || '\n\n' ||

        'RESPONSE (begin with the most clinically urgent point):';

    v_answer := (SELECT SNOWFLAKE.CORTEX.COMPLETE('mistral-7b', :v_prompt));

    v_result := OBJECT_CONSTRUCT(
        'answer', :v_answer,
        'data_as_of', :v_snapshot_at,
        'completeness_flags', :v_completeness,
        'search_results', :v_search_results
    );
    RETURN :v_result;
EXCEPTION
    WHEN OTHER THEN
        RETURN OBJECT_CONSTRUCT('answer', 'AI Error: ' || SQLERRM, 'data_as_of', CURRENT_TIMESTAMP());
END;
$$;

-- 6. COHORT ANALYTICS RAG PROCEDURE
CREATE OR REPLACE PROCEDURE process_cohort_query(
    p_question VARCHAR
)
RETURNS VARIANT
LANGUAGE SQL
AS
$$
DECLARE
    v_cohort_context VARCHAR;
    v_top_patients VARCHAR;
    v_search_results VARIANT;
    v_search_query VARCHAR;
    v_prompt VARCHAR;
    v_answer VARCHAR;
BEGIN
    -- Build cohort-level stats, falling back to summary column when diagnosis is stale
    SELECT
        'UNIT SUMMARY: Total Patients=' || COUNT(*) ||
        ', High Risk (score>0.80)=' || COUNT(CASE WHEN risk_score > 0.80 THEN 1 END) ||
        ', Moderate Risk (0.50-0.80)=' || COUNT(CASE WHEN risk_score BETWEEN 0.50 AND 0.80 THEN 1 END) ||
        ', Avg Risk Score=' || ROUND(AVG(risk_score), 2) ||
        ', Top Conditions: ' || COALESCE(
            LISTAGG(DISTINCT
                CASE
                    WHEN diagnosis IS NOT NULL
                         AND UPPER(TRIM(diagnosis)) NOT IN ('UNKNOWN', 'NO ACTIVE CONDITIONS', 'UNDOCUMENTED', '')
                    THEN diagnosis
                    ELSE TRIM(REGEXP_SUBSTR(summary, 'Active conditions:\\s*([^;\\n]+)', 1, 1, 'i', 1))
                END
            , ', ') WITHIN GROUP (ORDER BY
                CASE
                    WHEN diagnosis IS NOT NULL
                         AND UPPER(TRIM(diagnosis)) NOT IN ('UNKNOWN', 'NO ACTIVE CONDITIONS', 'UNDOCUMENTED', '')
                    THEN diagnosis
                    ELSE TRIM(REGEXP_SUBSTR(summary, 'Active conditions:\\s*([^;\\n]+)', 1, 1, 'i', 1))
                END
            ),
            'Data unavailable'
        )
    INTO :v_cohort_context
    FROM patients;

    -- Top 5 highest-risk patients with names for specific ranking questions
    SELECT LISTAGG(
        rn || '. ' || name ||
        ' (Risk=' || ROUND(risk_score, 2) || ', Dx=' ||
        COALESCE(
            CASE
                WHEN UPPER(TRIM(diagnosis)) NOT IN ('UNKNOWN', 'NO ACTIVE CONDITIONS', 'UNDOCUMENTED', '')
                THEN diagnosis
                ELSE TRIM(REGEXP_SUBSTR(summary, 'Active conditions:\\s*([^;\\n]+)', 1, 1, 'i', 1))
            END,
            'Unknown'
        ) || ')'
    , '\n') WITHIN GROUP (ORDER BY rn)
    INTO :v_top_patients
    FROM (
        SELECT name, risk_score, diagnosis, summary,
               ROW_NUMBER() OVER (ORDER BY risk_score DESC) AS rn
        FROM patients
        QUALIFY rn <= 5
    );

    -- Extract the actual nurse question text for keyword matching
    v_search_query := COALESCE(
        NULLIF(TRIM(REGEXP_SUBSTR(:p_question, 'NURSE QUESTION:\s*(.+)', 1, 1, 'es', 1)), ''),
        RIGHT(:p_question, 200)
    );

    -- Match KB docs where any meaningful word from the question appears in content or title
    v_search_results := (
        SELECT OBJECT_CONSTRUCT('results', COALESCE(ARRAY_AGG(
            OBJECT_CONSTRUCT(
                'source_title', source_title,
                'category', category,
                'policy_id', policy_id,
                'content', content
            )
        ), ARRAY_CONSTRUCT()))
        FROM (
            SELECT DISTINCT kb.source_title, kb.category, kb.policy_id, kb.content
            FROM knowledge_base kb,
                 LATERAL STRTOK_SPLIT_TO_TABLE(:v_search_query, ' ') AS t
            WHERE LENGTH(t.value) > 3
              AND REGEXP_REPLACE(LOWER(t.value), '[^a-z0-9-]', '') != ''
              AND (
                  LOWER(kb.content) LIKE '%' || REGEXP_REPLACE(LOWER(t.value), '[^a-z0-9-]', '') || '%'
                  OR LOWER(kb.source_title) LIKE '%' || REGEXP_REPLACE(LOWER(t.value), '[^a-z0-9-]', '') || '%'
              )
            LIMIT 5
        )
    );

    v_prompt :=
        'ROLE: Charge nurse assistant providing unit-level clinical intelligence for active inpatient management. ' ||
        'You support the charge nurse in identifying priorities, patterns, and risks across the entire unit census.' || '\n' ||

        'RULES:\n' ||
        '- Answer the specific question asked. Do not default to listing risk rankings unless the question explicitly asks for them.\n' ||
        '- If asked about conditions, answer about conditions. If asked about medications, answer about medications. Match the answer to the question.\n' ||
        '- Be concise. Use bullet points only when listing multiple discrete items.\n' ||
        '- Use patient names when referring to individuals. Do not use generic placeholders.\n' ||
        '- Ground all answers in the unit data provided. Do not invent patient details.\n' ||
        '- If the census data does not contain enough information to answer the question, say so explicitly.\n' ||
        '- Prefix genuinely critical findings with ALERT: only when clinically warranted.\n' ||
        '- Never diagnose. Recommend provider escalation when clinically indicated.\n' ||
        '- Cite applicable protocols briefly when directly relevant.\n' ||
        '- This tool supports clinical judgment; it does not replace it.\n\n' ||

        'UNIT CENSUS:\n' || :v_cohort_context || '\n\n' ||

        '--- RISK REFERENCE (use ONLY if the question is specifically about risk rankings or high-risk patients) ---\n' ||
        COALESCE(:v_top_patients, 'N/A') || '\n' ||
        '--- END RISK REFERENCE ---\n\n' ||

        'RELEVANT PROTOCOLS:\n' ||
        TO_VARCHAR(:v_search_results) || '\n\n' ||

        'QUESTION: ' || :p_question || '\n\n' ||

        'RESPONSE (answer the question above directly — do not recite risk rankings unless that is what was asked):';

    v_answer := (SELECT SNOWFLAKE.CORTEX.COMPLETE('mistral-7b', :v_prompt));

    RETURN OBJECT_CONSTRUCT(
        'answer', :v_answer,
        'data_as_of', CURRENT_TIMESTAMP(),
        'search_results', :v_search_results
    );
END;
$$;
