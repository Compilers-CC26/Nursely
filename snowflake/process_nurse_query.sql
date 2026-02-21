-- ============================================================
-- Stored Procedure: process_nurse_query
--
-- RAG pipeline: patient context + Cortex Search + AI_COMPLETE
-- Returns JSON: { answer, citations, flags, data_as_of }
-- ============================================================

CREATE OR REPLACE PROCEDURE process_nurse_query(
    p_patient_id VARCHAR,
    p_question VARCHAR,
    p_encounter_id VARCHAR DEFAULT NULL
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
    -- ────────────────────────────────────────────────
    -- 1. Get latest snapshot metadata
    -- ────────────────────────────────────────────────
    SELECT snapshot_at, completeness_flags
    INTO :v_snapshot_at, :v_completeness
    FROM patient_snapshots
    WHERE patient_id = :p_patient_id
    ORDER BY snapshot_at DESC
    LIMIT 1;

    -- ────────────────────────────────────────────────
    -- 2. Build structured patient context
    -- ────────────────────────────────────────────────
    SELECT LISTAGG(line, '\n') WITHIN GROUP (ORDER BY section_order)
    INTO :v_patient_context
    FROM (
        -- Demographics
        SELECT 1 AS section_order,
               'PATIENT: ' || name || ', ' || age || 'yo ' || sex ||
               ', Room ' || COALESCE(room, 'N/A') ||
               ', MRN: ' || COALESCE(mrn, 'N/A') ||
               ', Diagnosis: ' || COALESCE(diagnosis, 'Unknown') ||
               ', Risk Score: ' || COALESCE(TO_VARCHAR(risk_score, '0.00'), 'N/A') AS line
        FROM patients WHERE patient_id = :p_patient_id

        UNION ALL

        -- Allergies
        SELECT 2,
               'ALLERGIES: ' || COALESCE(
                   LISTAGG(allergen || COALESCE(' (' || severity || ')', ''), ', '),
                   'NKDA'
               )
        FROM allergies WHERE patient_id = :p_patient_id

        UNION ALL

        -- Current medications
        SELECT 3,
               'MEDICATIONS: ' || COALESCE(
                   LISTAGG(medication || COALESCE(' - ' || dosage, '') || ' (' || COALESCE(status, 'active') || ')', ', '),
                   'None documented'
               )
        FROM medications WHERE patient_id = :p_patient_id

        UNION ALL

        -- Latest vitals
        SELECT 4,
               'LATEST VITALS (' || TO_VARCHAR(effective_dt, 'YYYY-MM-DD HH24:MI') || '): ' ||
               'HR=' || COALESCE(TO_VARCHAR(hr), '?') ||
               ', BP=' || COALESCE(TO_VARCHAR(bp_sys), '?') || '/' || COALESCE(TO_VARCHAR(bp_dia), '?') ||
               ', RR=' || COALESCE(TO_VARCHAR(rr), '?') ||
               ', Temp=' || COALESCE(TO_VARCHAR(temp), '?') || '°F' ||
               ', SpO2=' || COALESCE(TO_VARCHAR(spo2), '?') || '%'
        FROM vitals
        WHERE patient_id = :p_patient_id
        ORDER BY effective_dt DESC
        LIMIT 1

        UNION ALL

        -- Recent labs (last 72h, abnormal first)
        SELECT 5,
               'LABS: ' || COALESCE(
                   LISTAGG(
                       lab_name || '=' || value || ' ' || unit ||
                       CASE WHEN flag != 'normal' THEN ' [' || UPPER(flag) || ']' ELSE '' END,
                       '; '
                   ) WITHIN GROUP (ORDER BY
                       CASE flag WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'low' THEN 3 ELSE 4 END,
                       effective_dt DESC
                   ),
                   'No recent labs'
               )
        FROM lab_results
        WHERE patient_id = :p_patient_id
          AND effective_dt >= DATEADD('hour', -72, CURRENT_TIMESTAMP())

        UNION ALL

        -- Recent notes (last 2)
        SELECT 6,
               'NURSING NOTES: ' || COALESCE(
                   LISTAGG(
                       '[' || TO_VARCHAR(note_dt, 'MM/DD HH24:MI') || '] ' || LEFT(note_text, 300),
                       ' | '
                   ) WITHIN GROUP (ORDER BY note_dt DESC),
                   'No recent notes'
               )
        FROM (
            SELECT note_text, note_dt
            FROM nursing_notes
            WHERE patient_id = :p_patient_id
            ORDER BY note_dt DESC
            LIMIT 2
        )
    );

    -- ────────────────────────────────────────────────
    -- 3. Cortex Search — retrieve relevant hospital docs
    -- ────────────────────────────────────────────────
    -- Search the knowledge base for docs relevant to the question
    SELECT SNOWFLAKE.CORTEX.SEARCH_PREVIEW(
        'knowledge_search',
        :p_question,
        5  -- top-k results
    ) INTO :v_search_results;

    -- ────────────────────────────────────────────────
    -- 4. Build prompt and call AI_COMPLETE
    -- ────────────────────────────────────────────────
    v_prompt := '
You are a clinical decision support assistant for nurses in an acute care hospital.

PATIENT CONTEXT (Data as of ' || COALESCE(TO_VARCHAR(:v_snapshot_at, 'YYYY-MM-DD HH24:MI'), 'unknown') || '):
' || COALESCE(:v_patient_context, 'No patient data available.') || '

RELEVANT HOSPITAL GUIDELINES AND PROTOCOLS:
' || COALESCE(TO_VARCHAR(:v_search_results), 'No relevant protocols found.') || '

COMPLETENESS FLAGS:
' || COALESCE(TO_VARCHAR(:v_completeness), 'All data available.') || '

NURSE QUESTION: ' || :p_question || '

INSTRUCTIONS:
1. Answer the nurse''s question using the patient context and hospital protocols above.
2. Be specific, actionable, and evidence-based.
3. If data is missing or stale, explicitly note this.
4. Cite specific protocols or guidelines by name when applicable.
5. Flag any safety concerns or escalation triggers.
6. Keep the response concise and structured for quick reading during care.
7. End with "Sources:" listing which documents/data you referenced.
';

    SELECT SNOWFLAKE.CORTEX.COMPLETE(
        'mistral-large',
        :v_prompt
    ) INTO :v_answer;

    -- ────────────────────────────────────────────────
    -- 5. Build and return result
    -- ────────────────────────────────────────────────
    v_result := OBJECT_CONSTRUCT(
        'answer', :v_answer,
        'data_as_of', :v_snapshot_at,
        'completeness_flags', :v_completeness,
        'search_results', :v_search_results,
        'patient_id', :p_patient_id,
        'question', :p_question
    );

    RETURN :v_result;
END;
$$;
