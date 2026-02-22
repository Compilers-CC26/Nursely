const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

// Load environment variables
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const isDev = !app.isPackaged;

// In development, enable loading TypeScript files directly
if (isDev) {
  try {
    require("ts-node").register({
      transpileOnly: true,
      compilerOptions: {
        module: "CommonJS",
        target: "ESNext",
      },
    });
    console.log("[Main] ts-node registered for development");
  } catch (err) {
    console.warn("[Main] Failed to register ts-node:", err.message);
  }
}

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

let backendServices = null;

async function getBackendServices() {
  if (backendServices) return backendServices;

  try {
    let fhirClient, fhirTransformer, snowflakeClient, syncOrchestrator;

    // In development with ts-node, we can require .ts files
    // In production, we require the compiled .js files
    try {
      fhirClient = require("./services/fhirClient");
      fhirTransformer = require("./services/fhirTransformer");
      snowflakeClient = require("./services/snowflakeClient");
      syncOrchestrator = require("./services/syncOrchestrator");
    } catch (e) {
      if (isDev) {
        // Explicitly try .ts extension if the default failed
        fhirClient = require("./services/fhirClient.ts");
        fhirTransformer = require("./services/fhirTransformer.ts");
        snowflakeClient = require("./services/snowflakeClient.ts");
        syncOrchestrator = require("./services/syncOrchestrator.ts");
      } else {
        throw e;
      }
    }

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
