type WsRuntimeStatus = "disconnected" | "connecting" | "connected" | "error";

type SatelliteStatus = {
  armed: boolean;
  wsStatus: WsRuntimeStatus;
  pairHttpPort: number;
  lastError?: string | null;
  lastMissionId?: string | null;
  missionsHandled: number;
};

type TestCaptureResult = {
  ok: boolean;
  width?: number;
  height?: number;
  pngBytes?: number;
  error?: string;
};

type PairResult = {
  ok: boolean;
  reason?: string;
};

type SatellitePermissionStatus = {
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
  pairFromUrl: (capturePairUrl: string) => Promise<PairResult>;
  testCapture: () => Promise<TestCaptureResult>;
  disarm: () => Promise<SatelliteStatus>;
  hideToTray: () => Promise<void>;
  checkPermissions: () => Promise<SatellitePermissionStatus>;
  openScreenRecordingSettings: () => Promise<void>;
  getDiagnostics: () => Promise<DiagnosticsReport>;
  onDisarm: (handler: () => void) => () => void;
};

declare global {
  interface Window {
    satellite: SatelliteApi;
  }
}

const api = window.satellite;

const pairPortEl = document.querySelector<HTMLElement>("#pair-port")!;
const captureResultEl = document.querySelector<HTMLElement>("#capture-result")!;
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
  pairPortEl.textContent = String(status.pairHttpPort);
  statusArmedEl.textContent = status.armed ? "ARMED" : "DISARMED";
  statusWsEl.textContent = status.wsStatus.toUpperCase();
  statusMissionsEl.textContent = String(status.missionsHandled);
  statusErrorEl.textContent = status.lastError?.trim() || "—";
}

document.querySelector<HTMLButtonElement>("#test-capture")!.addEventListener("click", async () => {
  captureResultEl.textContent = "Capturing…";
  const result = await api.testCapture();
  if (result.ok) {
    captureResultEl.textContent = `OK ${result.width ?? "?"}×${result.height ?? "?"} · ~${result.pngBytes ?? 0} b64 chars`;
  } else {
    captureResultEl.textContent = result.error ?? "Capture failed";
  }
  await refreshPermissions();
});

openScreenSettingsBtn.addEventListener("click", async () => {
  await api.openScreenRecordingSettings();
});

document.querySelector<HTMLButtonElement>("#pair-url-btn")!.addEventListener("click", async () => {
  const url = document.querySelector<HTMLTextAreaElement>("#pair-url")!.value.trim();
  if (!url) {
    captureResultEl.textContent = "Paste the Mirage Echo QR URL first.";
    return;
  }
  captureResultEl.textContent = "Pairing…";
  const result = await api.pairFromUrl(url);
  if (result.ok) {
    captureResultEl.textContent = "Paired and armed — hide to tray when ready.";
    await refreshStatus();
  } else {
    captureResultEl.textContent = result.reason ?? "Pair failed";
  }
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

void refreshPermissions();
void refreshStatus();
void refreshDiagnostics();
window.setInterval(() => {
  void refreshStatus();
}, 5000);
