type WsRuntimeStatus = "disconnected" | "connecting" | "connected" | "error";

type SpyMirageLink = {
  nodeId: string;
  pairedAt: string;
};

type CaptureMirageLink = {
  host: string;
  port: number;
};

type SatelliteStatus = {
  armed: boolean;
  wsStatus: WsRuntimeStatus;
  pairHttpPort: number;
  lastError?: string | null;
  lastMissionId?: string | null;
  missionsHandled: number;
  spyMirages: SpyMirageLink[];
  spyLinksReachable: boolean;
  captureMirage: CaptureMirageLink | null;
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

type UpdateCheckResult =
  | {
      ok: true;
      currentVersion: string;
      latestVersion: string;
      updateAvailable: boolean;
      releaseUrl: string;
      downloadUrl: string | null;
      fileName: string | null;
      reason?: string | null;
    }
  | { ok: false; reason: string };

type SatelliteApi = {
  getStatus: () => Promise<SatelliteStatus>;
  pairFromUrl: (capturePairUrl: string) => Promise<PairResult>;
  testCapture: () => Promise<TestCaptureResult>;
  disarm: () => Promise<SatelliteStatus>;
  hideToTray: () => Promise<void>;
  checkPermissions: () => Promise<SatellitePermissionStatus>;
  openScreenRecordingSettings: () => Promise<void>;
  getDiagnostics: () => Promise<DiagnosticsReport>;
  checkForUpdates: () => Promise<UpdateCheckResult>;
  downloadAndInstallUpdate: (input: {
    downloadUrl: string;
    fileName: string;
  }) => Promise<{ ok: true; message: string; quitApp?: boolean } | { ok: false; reason: string }>;
  onDisarm: (handler: () => void) => () => void;
  onStatusChanged: (handler: () => void) => () => void;
  onUpdateAvailable: (handler: (result: UpdateCheckResult) => void) => () => void;
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
const statusMiragesEl = document.querySelector<HTMLElement>("#status-mirages")!;
const statusErrorEl = document.querySelector<HTMLElement>("#status-error")!;
const diagHintEl = document.querySelector<HTMLElement>("#diag-hint")!;
const diagVersionEl = document.querySelector<HTMLElement>("#diag-version")!;
const diagModeEl = document.querySelector<HTMLElement>("#diag-mode")!;
const diagLogPathEl = document.querySelector<HTMLElement>("#diag-log-path")!;
const diagLogTailEl = document.querySelector<HTMLElement>("#diag-log-tail")!;
const updateStatusEl = document.querySelector<HTMLElement>("#update-status")!;
const checkUpdatesBtn = document.querySelector<HTMLButtonElement>("#check-updates")!;
const installUpdateBtn = document.querySelector<HTMLButtonElement>("#install-update")!;

let pendingUpdate: Extract<UpdateCheckResult, { ok: true }> | null = null;

function renderUpdateStatus(result: UpdateCheckResult): void {
  if (!result.ok) {
    updateStatusEl.textContent = result.reason;
    installUpdateBtn.classList.add("hidden");
    pendingUpdate = null;
    return;
  }

  pendingUpdate = result.updateAvailable && result.downloadUrl && result.fileName ? result : null;

  if (result.updateAvailable) {
    updateStatusEl.textContent = result.reason
      ? `Update ${result.latestVersion} available — ${result.reason}`
      : `Update available: v${result.latestVersion} (you have v${result.currentVersion}).`;
    if (pendingUpdate) {
      installUpdateBtn.classList.remove("hidden");
    } else {
      installUpdateBtn.classList.add("hidden");
    }
    return;
  }

  updateStatusEl.textContent = `Up to date — v${result.currentVersion}.`;
  installUpdateBtn.classList.add("hidden");
  pendingUpdate = null;
}

async function refreshUpdateCheck(): Promise<void> {
  checkUpdatesBtn.disabled = true;
  updateStatusEl.textContent = "Checking for updates…";
  const result = await api.checkForUpdates();
  renderUpdateStatus(result);
  checkUpdatesBtn.disabled = false;
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

function formatLinkedMirages(status: SatelliteStatus): string {
  const lines: string[] = [];
  for (const mirage of status.spyMirages) {
    lines.push(`${mirage.nodeId.slice(0, 8)}… (Spy team)`);
  }
  if (status.captureMirage) {
    const armedSuffix = status.armed ? " · armed" : "";
    lines.push(`${status.captureMirage.host}:${status.captureMirage.port} (Capture relay${armedSuffix})`);
  }
  if (lines.length === 0) {
    return status.spyLinksReachable
      ? "No Mirage linked yet"
      : "Open cyberdeck Spy tab on this machine for Spy team links";
  }
  return lines.join("\n");
}

async function refreshStatus(): Promise<void> {
  const status = await api.getStatus();
  const mirageSummary = formatLinkedMirages(status);
  pairPortEl.textContent = String(status.pairHttpPort);
  statusArmedEl.textContent = status.armed ? "ARMED" : "DISARMED";
  statusMiragesEl.textContent = mirageSummary;
  statusMiragesEl.classList.toggle(
    "empty",
    mirageSummary.includes("No Mirage") || mirageSummary.includes("Open cyberdeck"),
  );
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

document.querySelector<HTMLButtonElement>("#refresh-status")!.addEventListener("click", async () => {
  await refreshStatus();
});

checkUpdatesBtn.addEventListener("click", async () => {
  await refreshUpdateCheck();
});

installUpdateBtn.addEventListener("click", async () => {
  if (!pendingUpdate?.downloadUrl || !pendingUpdate.fileName) return;
  installUpdateBtn.disabled = true;
  checkUpdatesBtn.disabled = true;
  updateStatusEl.textContent = "Downloading update…";
  const result = await api.downloadAndInstallUpdate({
    downloadUrl: pendingUpdate.downloadUrl,
    fileName: pendingUpdate.fileName,
  });
  if (!result.ok) {
    updateStatusEl.textContent = result.reason;
    installUpdateBtn.disabled = false;
    checkUpdatesBtn.disabled = false;
    return;
  }
  updateStatusEl.textContent = result.message;
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

api.onStatusChanged(() => {
  void refreshStatus();
});

api.onUpdateAvailable((result) => {
  renderUpdateStatus(result);
});

void refreshPermissions();
void refreshStatus();
void refreshDiagnostics();
void refreshUpdateCheck();
window.setInterval(() => {
  void refreshStatus();
}, 5000);
