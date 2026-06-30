import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("satellite", {
  getStatus: () => ipcRenderer.invoke("satellite:get-status"),
  pairFromUrl: (capturePairUrl) => ipcRenderer.invoke("satellite:pair-from-url", capturePairUrl),
  testCapture: () => ipcRenderer.invoke("satellite:test-capture"),
  disarm: () => ipcRenderer.invoke("satellite:disarm"),
  hideToTray: () => ipcRenderer.invoke("satellite:hide-to-tray"),
  checkPermissions: () => ipcRenderer.invoke("satellite:check-permissions"),
  openScreenRecordingSettings: () => ipcRenderer.invoke("satellite:open-screen-settings"),
  getDiagnostics: () => ipcRenderer.invoke("satellite:get-diagnostics"),
  onDisarm: (handler) => {
    const listener = () => handler();
    ipcRenderer.on("satellite:disarm", listener);
    return () => ipcRenderer.removeListener("satellite:disarm", listener);
  },
  onStatusChanged: (handler) => {
    const listener = () => handler();
    ipcRenderer.on("satellite:status-changed", listener);
    return () => ipcRenderer.removeListener("satellite:status-changed", listener);
  },
  checkForUpdates: () => ipcRenderer.invoke("satellite:check-for-updates"),
  downloadAndInstallUpdate: (input) =>
    ipcRenderer.invoke("satellite:download-and-install-update", input),
  onUpdateAvailable: (handler) => {
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on("satellite:update-available", listener);
    return () => ipcRenderer.removeListener("satellite:update-available", listener);
  },
});
