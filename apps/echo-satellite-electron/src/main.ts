type WsRuntimeStatus = "disconnected" | "connecting" | "connected" | "error";

type SatelliteStatus = {
  armed: boolean;
  wsStatus: WsRuntimeStatus;
  pairHttpPort: number;
  lastError?: string | null;
  lastMissionId?: string | null;
  missionsHandled: number;
};

type SpyCodesStatus = {
  ok: true;
  echoNodeId: string;
  echoHost: string;
  httpPort: number;
  miragePin: string | null;
  powerfistPin: string | null;
  mirageExpiresAt: string | null;
  powerfistExpiresAt: string | null;
  pairedMirage: { nodeId: string; pairedAt: string } | null;
  pairedPowerfist: { deviceId: string; pairedAt: string } | null;
};

type TestCaptureResult = {
  ok: boolean;
  width?: number;
  height?: number;
  pngBytes?: number;
  previewDataUrl?: string;
  error?: string;
};

type PermissionStatus = {
  platform: string;
  screenRecording: boolean;
  hint?: string | null;
};

type DiagnosticsReport = {
  version: string;
  platform: string;
  trayMode: string;
  logPath: string;
  sessionId: string;
  previousSessionCrashed: boolean;
  logTail: string;
  supportHint: string;
};

type SatelliteApi = {
  getStatus: () => Promise<SatelliteStatus>;
  getSpyCodes: () => Promise<SpyCodesStatus>;
  regenerateSpyCodes: () => Promise<SpyCodesStatus>;
  testCapture: () => Promise<TestCaptureResult>;
  disarm: () => Promise<SatelliteStatus>;
  hideToTray: () => Promise<void>;
  checkPermissions: () => Promise<PermissionStatus>;
  openScreenRecordingSettings: () => Promise<void>;
  getDiagnostics: () => Promise<DiagnosticsReport>;
  onDisarm: (handler: () => void) => () => void;
  onSpyCodesChanged: (handler: () => void) => () => void;
};

declare global {
  interface Window {
    satellite: SatelliteApi;
  }
}

const api = window.satellite;

const pairPortEl = document.querySelector<HTMLElement>("#pair-port")!;
const echoLanEl = document.querySelector<HTMLElement>("#echo-lan")!;
const miragePinEl = document.querySelector<HTMLElement>("#mirage-pin")!;
const powerfistPinEl = document.querySelector<HTMLElement>("#powerfist-pin")!;
const mirageExpiryEl = document.querySelector<HTMLElement>("#mirage-expiry")!;
const powerfistExpiryEl = document.querySelector<HTMLElement>("#powerfist-expiry")!;
const pairStatusEl = document.querySelector<HTMLElement>("#pair-status")!;
const captureResultEl = document.querySelector<HTMLElement>("#capture-result")!;
const capturePreviewEl = document.querySelector<HTMLImageElement>("#capture-preview")!;
const testCaptureBtn = document.querySelector<HTMLButtonElement>("#test-capture")!;
const permissionResultEl = document.querySelector<HTMLElement>("#permission-result")!;
const openScreenSettingsBtn = document.querySelector<HTMLButtonElement>("#open-screen-settings")!;
const statusArmedEl = document.querySelector<HTMLElement>("#status-armed")!;
const statusWsEl = document.querySelector<HTMLElement>("#status-ws")!;
const statusMissionsEl = document.querySelector<HTMLElement>("#status-missions")!;
const statusErrorEl = document.querySelector<HTMLElement>("#status-error")!;
const diagHintEl = document.querySelector<HTMLElement>("#diag-hint")!;
const diagVersionEl = document.querySelector<HTMLElement>("#diag-version")!;
const diagModeEl = document.querySelector<HTMLElement>("#diag-mode")!;
const diagLogPathEl = document.querySelector<HTMLElement>("#diag-log-path")!;
const diagLogTailEl = document.querySelector<HTMLElement>("#diag-log-tail")!;

function formatCodeExpiry(expiresAt: string | null): string {
  if (!expiresAt) return "";
  const ms = Date.parse(expiresAt) - Date.now();
  if (ms <= 0) return "Expired — tap New codes";
  const minutes = Math.ceil(ms / 60_000);
  return `Expires in ${minutes} min`;
}

function formatPin(pin: string | null): string {
  return pin ?? "——";
}

function formatDiagnostics(report: DiagnosticsReport): string {
  return [
    "Echo Satellite diagnostics (Electron)",
    `version: ${report.version}`,
    `platform: ${report.platform}`,
    `trayMode: ${report.trayMode}`,
    `sessionId: ${report.sessionId}`,
    `logPath: ${report.logPath}`,
    "",
    "--- startup.log (tail) ---",
    report.logTail,
  ].join("\n");
}

async function refreshSpyCodes(): Promise<void> {
  const codes = await api.getSpyCodes();
  pairPortEl.textContent = String(codes.httpPort);
  echoLanEl.textContent = `Echo on LAN · ${codes.echoHost}:${codes.httpPort}`;
  miragePinEl.textContent = formatPin(codes.miragePin);
  powerfistPinEl.textContent = formatPin(codes.powerfistPin);
  mirageExpiryEl.textContent = formatCodeExpiry(codes.mirageExpiresAt);
  powerfistExpiryEl.textContent = formatCodeExpiry(codes.powerfistExpiresAt);

  const parts: string[] = [];
  if (codes.pairedMirage) {
    parts.push(`PAIRED // MIRAGE ${codes.pairedMirage.nodeId.slice(0, 8)}…`);
  }
  if (codes.pairedPowerfist) {
    parts.push(`PAIRED // PowerFist ${codes.pairedPowerfist.deviceId.slice(0, 8)}…`);
  }
  pairStatusEl.textContent = parts.length > 0 ? parts.join(" · ") : "Waiting for Mirage / PowerFist to enter codes.";
}

async function refreshDiagnostics(): Promise<DiagnosticsReport> {
  const report = await api.getDiagnostics();
  diagHintEl.textContent = report.supportHint;
  diagVersionEl.textContent = `${report.version} (${report.platform})`;
  diagModeEl.textContent = report.trayMode;
  diagLogPathEl.textContent = report.logPath;
  diagLogTailEl.textContent = report.logTail || "(empty)";
  return report;
}

async function refreshPermissions(): Promise<void> {
  const perm = await api.checkPermissions();
  if (perm.screenRecording) {
    permissionResultEl.textContent = "Screen Recording: granted";
    openScreenSettingsBtn.classList.remove("show");
  } else {
    permissionResultEl.textContent =
      perm.hint ?? "Screen Recording not granted — required before missions.";
    if (perm.platform === "macos") {
      openScreenSettingsBtn.classList.add("show");
    }
  }
}

async function refreshStatus(): Promise<void> {
  const status = await api.getStatus();
  statusArmedEl.textContent = status.armed ? "ARMED" : "DISARMED";
  statusWsEl.textContent = status.wsStatus.toUpperCase();
  statusMissionsEl.textContent = String(status.missionsHandled);
  statusErrorEl.textContent = status.lastError?.trim() || "—";
}

document.querySelector<HTMLButtonElement>("#test-capture")!.addEventListener("click", async () => {
  testCaptureBtn.disabled = true;
  captureResultEl.textContent = "Capturing…";
  capturePreviewEl.classList.add("hidden");
  capturePreviewEl.removeAttribute("src");

  try {
    const result = await api.testCapture();
    if (result.ok) {
      captureResultEl.textContent = `OK ${result.width ?? "?"}×${result.height ?? "?"} — preview below`;
      if (result.previewDataUrl) {
        capturePreviewEl.src = result.previewDataUrl;
        capturePreviewEl.classList.remove("hidden");
      }
    } else {
      captureResultEl.textContent = result.error ?? "Capture failed";
    }
  } catch (error) {
    captureResultEl.textContent = error instanceof Error ? error.message : "Capture failed";
  } finally {
    testCaptureBtn.disabled = false;
    await refreshPermissions();
  }
});

openScreenSettingsBtn.addEventListener("click", async () => {
  await api.openScreenRecordingSettings();
});

document.querySelector<HTMLButtonElement>("#new-codes-btn")!.addEventListener("click", async () => {
  await api.regenerateSpyCodes();
  await refreshSpyCodes();
});

document.querySelector<HTMLButtonElement>("#hide-tray")!.addEventListener("click", async () => {
  await api.hideToTray();
});

document.querySelector<HTMLButtonElement>("#disarm")!.addEventListener("click", async () => {
  await api.disarm();
  await refreshStatus();
});

document.querySelector<HTMLButtonElement>("#refresh-diagnostics")!.addEventListener("click", async () => {
  await refreshDiagnostics();
});

document.querySelector<HTMLButtonElement>("#copy-diagnostics")!.addEventListener("click", async () => {
  const report = await refreshDiagnostics();
  const text = formatDiagnostics(report);
  try {
    await navigator.clipboard.writeText(text);
    diagHintEl.textContent = "Diagnostics copied to clipboard.";
  } catch {
    diagHintEl.textContent = "Could not copy — select text in the log box manually.";
  }
});

api.onDisarm(() => {
  void refreshStatus();
});

api.onSpyCodesChanged(() => {
  void refreshSpyCodes();
});

void refreshPermissions();
void refreshStatus();
void refreshSpyCodes();
void refreshDiagnostics();
window.setInterval(() => {
  void refreshStatus();
  void refreshSpyCodes();
}, 5000);
