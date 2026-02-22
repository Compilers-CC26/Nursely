const { contextBridge, ipcRenderer } = require("electron");

/**
 * Preload script — exposes typed IPC bridge to the renderer process.
 *
 * Renderer accesses these via window.electronAPI.fhir.* and window.electronAPI.snowflake.*
 */
contextBridge.exposeInMainWorld("electronAPI", {
  // ── FHIR API ──
  fhir: {
    /** Fetch a full FHIR Bundle for a patient */
    fetchBundle: (patientId) =>
      ipcRenderer.invoke("fhir:fetch-patient-bundle", patientId),

    /** Fetch a list of patients from FHIR server */
    fetchPatientList: (count) =>
      ipcRenderer.invoke("fhir:fetch-patient-list", count),

    /** Get the dynamically built rich in-memory census */
    getCensus: () => ipcRenderer.invoke("fhir:get-census"),

    /** Clear the FHIR session cache */
    clearCache: () => ipcRenderer.invoke("fhir:clear-cache"),
  },

  // ── Snowflake API ──
  snowflake: {
    /** Sync a patient's data: FHIR → Snowflake */
    syncPatient: (patientId) =>
      ipcRenderer.invoke("snowflake:sync-patient", patientId),

    /** Ask a question via the RAG stored procedure */
    query: (patientId, question, encounterId) =>
      ipcRenderer.invoke("snowflake:query", {
        patientId,
        question,
        encounterId,
      }),

    /** Get cohort-level analytics from Snowflake */
    getCohortSummary: () =>
      ipcRenderer.invoke("snowflake:cohort-summary"),

    /** Pre-seed multiple patients in the background */
    preseedCohort: (patientIds) =>
      ipcRenderer.invoke("snowflake:preseed-cohort", patientIds),

    /** Check if Snowflake connection is available */
    getStatus: () => ipcRenderer.invoke("snowflake:status"),
  },
});
