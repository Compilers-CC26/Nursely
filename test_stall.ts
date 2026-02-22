import { isPatientSyncedRecent, getLastSyncTime } from "./electron/services/snowflakeClient";
import { syncPatient } from "./electron/services/syncOrchestrator";

async function run() {
    const id = "f9ed4a8e-44f9-4392-bf35-9857b65937c5";
    const t = await getLastSyncTime(id);
    console.log("Last sync time:", t, t?.getTime());
    console.log("Current time:", new Date(), Date.now());
    
    const isRecent = await isPatientSyncedRecent(id);
    console.log("Is Recent:", isRecent);

    const result = await syncPatient(id);
    console.log("Sync Result:", result);
    process.exit(0);
}
run();
