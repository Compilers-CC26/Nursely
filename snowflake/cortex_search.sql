-- ============================================================
-- Cortex Search Service for Knowledge Base RAG
-- ============================================================
-- Prerequisites:
--   1. Snowflake Cortex features enabled on your account
--   2. knowledge_base table created and populated
--   3. Appropriate warehouse running

-- Create Cortex Search service on knowledge_base content
-- This indexes the 'content' column for semantic search
CREATE OR REPLACE CORTEX SEARCH SERVICE knowledge_search
  ON knowledge_base
  WAREHOUSE = PATIENT_ANALYST_WH
  TARGET_LAG = '1 hour'
  ATTRIBUTES = 'source_title, category, policy_id, version'
  AS (
    SELECT
      doc_id,
      content,
      source_title,
      category,
      policy_id,
      version,
      published_date
    FROM knowledge_base
  );

-- ============================================================
-- Optional: Patient Documents Search (notes + clinical text)
-- ============================================================
-- If you want Cortex Search to also index patient-specific notes
-- alongside hospital docs (allows patient_id filtering):

-- CREATE OR REPLACE CORTEX SEARCH SERVICE patient_doc_search
--   ON nursing_notes
--   WAREHOUSE = PATIENT_ANALYST_WH
--   TARGET_LAG = '1 hour'
--   ATTRIBUTES = 'patient_id, author, fhir_resource_type'
--   AS (
--     SELECT
--       note_id,
--       note_text AS content,
--       patient_id,
--       author,
--       fhir_resource_type,
--       note_dt
--     FROM nursing_notes
--   );
