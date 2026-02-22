/**
 * Type declarations for the Electron IPC bridge
 * exposed via window.electronAPI in preload.cjs
 */

export interface ElectronAPI {
  fhir: {
    fetchBundle: (patientId: string) => Promise<{
      success: boolean;
      bundle?: any;
      error?: string;
    }>;
    fetchPatientList: (count?: number) => Promise<{
      success: boolean;
      patients?: any[];
      error?: string;
    }>;
    getCensus: () => Promise<{
      success: boolean;
      census?: any[];
      error?: string;
    }>;
    clearCache: () => Promise<{ success: boolean }>;
  };
  snowflake: {
    syncPatient: (patientId: string) => Promise<{
      success: boolean;
      patientId: string;
      snapshotId: string | null;
      rowsWritten: number;
      completenessFlags: Record<string, any>;
      syncDurationMs: number;
      error?: string;
    }>;
    query: (
      patientId: string,
      question: string,
      encounterId?: string
    ) => Promise<{
      success: boolean;
      answer?: string;
      citations?: Array<{ title: string; source: string; url: string }>;
      flags?: string[];
      dataAsOf?: string;
      error?: string;
    }>;
    getCohortSummary: () => Promise<{
      success: boolean;
      summary?: any;
      error?: string;
    }>;
    preseedCohort: (patientIds: string[]) => Promise<{
      success: boolean;
      total: number;
      synced: number;
      errors: number;
      error?: string;
    }>;
    getStatus: () => Promise<{
      available: boolean;
      reason?: string;
    }>;
  };
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
