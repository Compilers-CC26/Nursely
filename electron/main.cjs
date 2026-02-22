const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

const fs = require("fs");

const isDev = !app.isPackaged;

// Load environment variables based on environment
if (isDev) {
  require("dotenv").config({ path: path.join(__dirname, "../.env") });
} else {
  // In production, the .env file is bundled inside the app.asar package
  const envPath = path.join(process.resourcesPath, "app.asar", ".env");
  if (fs.existsSync(envPath)) {
    require("dotenv").config({ path: envPath });
    console.log("[Main] Loaded bundled .env config.");
  } else {
    console.warn("[Main] WARNING: No .env file found inside app bundle at", envPath);
  }
}

// In development, enable loading TypeScript files directly
if (isDev) {
  try {
    require("ts-node").register({
      transpileOnly: true,
      skipProject: true, // Ignore root tsconfig.json to avoid conflicts with Vite/frontend settings
      compilerOptions: {
        module: "CommonJS",
        target: "ESNext",
        moduleResolution: "Node",
        allowJs: true,
        skipLibCheck: true,
        esModuleInterop: true,
        resolveJsonModule: true
      },
    });
    console.log("[Main] ts-node registered for development (CommonJS, Isolated)");
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
    console.log("[Main] Loading backend services...");

    // With "type": "module" removed, standard require works with ts-node/register
    const fhirClient = require("./services/fhirClient");
    const fhirTransformer = require("./services/fhirTransformer");
    const snowflakeClient = require("./services/snowflakeClient");
    const syncOrchestrator = require("./services/syncOrchestrator");
    const censusService = require("./services/censusService");

    backendServices = {
      fhirClient,
      fhirTransformer,
      snowflakeClient,
      syncOrchestrator,
      censusService,
    };

    console.log("[Main] Backend services loaded successfully");
    return backendServices;
  } catch (err) {
    console.error("[Main] Failed to load backend services:", err);
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

ipcMain.handle("fhir:get-census", async (event) => {
  try {
    const services = await getBackendServices();
    if (!services) {
      return { success: false, error: "Backend services not available" };
    }

    // Pass a callback that sends individual patients to the UI as they are discovered/transformed
    const census = await services.censusService.getCensus(false, (patient) => {
      event.sender.send("fhir:on-patient-update", patient);
    });

    return { success: true, census };
  } catch (err) {
    console.error("[Main] IPC: fhir:get-census error:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("fhir:get-patient", async (_event, patientId) => {
  try {
    const services = await getBackendServices();
    if (!services) {
      return { success: false, error: "Backend services not available" };
    }
    const patient = await services.censusService.getPatientById(patientId);
    return { success: true, patient };
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
    console.log(`[Main] IPC: snowflake:sync-patient ${patientId}`);
    const services = await getBackendServices();
    if (!services) {
      return { success: false, error: "Backend services not available" };
    }
    const result = await services.syncOrchestrator.syncPatient(patientId);
    console.log(`[Main] IPC: snowflake:sync-patient result:`, result.success ? "Success" : "Failed");
    return result;
  } catch (err) {
    console.error(`[Main] IPC: snowflake:sync-patient error:`, err);
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

      // Route to cohort query if no patientId is provided
      if (!patientId) {
        const result = await services.syncOrchestrator.askGlobalQuestion(question);
        return { success: true, ...result };
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

ipcMain.handle("snowflake:preseed-cohort", async (_event, patientIds) => {
  try {
    console.log(`[Main] IPC: snowflake:preseed-cohort (${patientIds.length} patients)`);
    const services = await getBackendServices();
    if (!services) {
      return { success: false, error: "Backend services not available" };
    }
    const result = await services.syncOrchestrator.preseedCohort(patientIds);
    return { success: true, ...result };
  } catch (err) {
    console.error(`[Main] IPC: snowflake:preseed-cohort error:`, err);
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
