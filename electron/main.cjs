const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

// Load environment variables
require("dotenv").config({ path: path.join(__dirname, "../.env") });

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // In development, load the Vite dev server
  // In production, load the built index.html
  const isDev = !app.isPackaged;
  if (isDev) {
    const devUrl = process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";
    win.loadURL(devUrl);
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

// ════════════════════════════════════════════════
// IPC Handlers — Backend bridge for renderer
// ════════════════════════════════════════════════

// Lazy-load backend services (TypeScript compiled at build time)
// For development, these will be loaded from the compiled output
// For now, we use a try/catch to gracefully handle missing compiled files

let backendServices = null;

async function getBackendServices() {
  if (backendServices) return backendServices;

  try {
    // These will be available once the TypeScript backend is compiled
    const fhirClient = require("./services/fhirClient");
    const fhirTransformer = require("./services/fhirTransformer");
    const snowflakeClient = require("./services/snowflakeClient");
    const syncOrchestrator = require("./services/syncOrchestrator");

    backendServices = {
      fhirClient,
      fhirTransformer,
      snowflakeClient,
      syncOrchestrator,
    };

    return backendServices;
  } catch (err) {
    console.warn("[Main] Backend services not available:", err.message);
    return null;
  }
}

// ── FHIR IPC Handlers ──

ipcMain.handle("fhir:fetch-patient-bundle", async (_event, patientId) => {
  try {
    const services = await getBackendServices();
    if (!services) {
      return { success: false, error: "Backend services not available" };
    }
    const bundle = await services.fhirClient.fetchPatientBundle(patientId);
    return { success: true, bundle };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("fhir:fetch-patient-list", async (_event, count) => {
  try {
    const services = await getBackendServices();
    if (!services) {
      return { success: false, error: "Backend services not available" };
    }
    const patients = await services.fhirClient.fetchPatientList(count);
    return { success: true, patients };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("fhir:clear-cache", async () => {
  try {
    const services = await getBackendServices();
    if (!services) return { success: false };
    services.fhirClient.clearFHIRCache();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── Snowflake Sync IPC Handlers ──

ipcMain.handle("snowflake:sync-patient", async (_event, patientId) => {
  try {
    const services = await getBackendServices();
    if (!services) {
      return { success: false, error: "Backend services not available" };
    }
    const result = await services.syncOrchestrator.syncPatient(patientId);
    return result;
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle(
  "snowflake:query",
  async (_event, { patientId, question, encounterId }) => {
    try {
      const services = await getBackendServices();
      if (!services) {
        return { success: false, error: "SNOWFLAKE_UNAVAILABLE" };
      }
      const result = await services.syncOrchestrator.askQuestion(
        patientId,
        question,
        encounterId
      );
      return { success: true, ...result };
    } catch (err) {
      // If Snowflake is unavailable, the renderer will fallback to mock
      return { success: false, error: err.message };
    }
  }
);

ipcMain.handle("snowflake:cohort-summary", async () => {
  try {
    const services = await getBackendServices();
    if (!services) {
      return { success: false, error: "Backend services not available" };
    }
    const summary = await services.snowflakeClient.getCohortSummary();
    return { success: true, summary };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("snowflake:status", async () => {
  try {
    const services = await getBackendServices();
    if (!services) return { available: false, reason: "Backend not loaded" };
    const available = await services.snowflakeClient.isSnowflakeAvailable();
    return { available };
  } catch (err) {
    return { available: false, reason: err.message };
  }
});

// ════════════════════════════════════════════════
// App lifecycle
// ════════════════════════════════════════════════

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  // Close Snowflake connection on quit
  getBackendServices().then((services) => {
    if (services) services.snowflakeClient.closeConnection();
  });
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
