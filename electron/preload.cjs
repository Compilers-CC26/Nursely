// Minimal preload script — no IPC needed for this MVP
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
});
