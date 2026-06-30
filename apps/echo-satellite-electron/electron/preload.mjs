import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("satellite", {
  getStatus: () => ipcRenderer.invoke("satellite:get-status"),
  getSpyCodes: () => ipcRenderer.invoke("satellite:get-spy-codes"),
  regenerateSpyCodes: () => ipcRenderer.invoke("satellite:regenerate-spy-codes"),
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
  onSpyCodesChanged: (handler) => {
    const listener = () => handler();
    ipcRenderer.on("satellite:spy-codes-changed", listener);
    return () => ipcRenderer.removeListener("satellite:spy-codes-changed", listener);
  },
});
