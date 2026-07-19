import { installEchoSttBridge } from "./stt";

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
  surveyLinksReachable: boolean;
  captureMirage: CaptureMirageLink | null;
};

type TestCaptureResult = {
  ok: boolean;
  width?: number;
  height?: number;
  pngBytes?: number;
  pngBase64?: string;
  error?: string;
};

type PairResult = {
  ok: boolean;
  reason?: string;
};

type SatellitePermissionStatus = {
  platform: string;
  screenRecording: boolean;
  microphone?: boolean;
  microphoneStatus?: string;
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

type SpyCodes = {
  ok: true;
  echoNodeId?: string;
  echoHost: string;
  httpPort: number;
  lanHosts?: string[];
  miragePin: string | null;
  powerfistPin: string | null;
  mirageExpiresAt: string | null;
  powerfistExpiresAt: string | null;
  pairedMirages: SpyMirageLink[];
};

type SendToMirageResult =
  | {
      ok: true;
      message: string;
      mirageUrl: string;
      host: string;
      port: number;
      pin: string;
    }
  | { ok: false; reason: string };

type SatelliteApi = {
  getStatus: () => Promise<SatelliteStatus>;
  getSpyCodes: () => Promise<SpyCodes | { ok: false; reason: string }>;
  regenerateSpyCodes: () => Promise<SpyCodes | { ok: false; reason: string }>;
  sendToMirage: () => Promise<SendToMirageResult>;
  pairFromUrl: (capturePairUrl: string) => Promise<PairResult>;
  testCapture: () => Promise<TestCaptureResult>;
  disarm: () => Promise<SatelliteStatus>;
  hideToTray: () => Promise<void>;
  checkPermissions: () => Promise<SatellitePermissionStatus>;
  openScreenRecordingSettings: () => Promise<void>;
  getDiagnostics: () => Promise<DiagnosticsReport>;
  getRelaySecretStatus: () => Promise<{ ok: true; configured: boolean; preview: string }>;
  saveRelaySecret: (
    secret: string,
  ) => Promise<{ ok: true; configured: boolean } | { ok: false; reason: string }>;
  checkForUpdates: () => Promise<UpdateCheckResult>;
  downloadAndInstallUpdate: (input: {
    downloadUrl: string;
    fileName: string;
  }) => Promise<{ ok: true; message: string; quitApp?: boolean } | { ok: false; reason: string }>;
  onDisarm: (handler: () => void) => () => void;
  onStatusChanged: (handler: () => void) => () => void;
  onUpdateAvailable: (handler: (result: UpdateCheckResult) => void) => () => void;
  onSttStart: (handler: (payload?: { lang?: string }) => void) => () => void;
  onSttStop: (handler: (payload?: unknown) => void) => () => void;
  reportStt: (report: {
    interim?: string;
    final?: string;
    error?: string;
    listening?: boolean;
    level?: number;
    bands?: number[];
  }) => Promise<{ ok: boolean }>;
  getListeningState: () => Promise<{
    ok: boolean;
    listening?: boolean;
    interim?: string;
    lastFinal?: string;
    error?: string | null;
    level?: number;
    bands?: number[];
  }>;
};

declare global {
  interface Window {
    satellite: SatelliteApi;
  }
}

const api = window.satellite;

const echoTeamIdEl = document.querySelector<HTMLElement>("#echo-team-id")!;
const echoLanEl = document.querySelector<HTMLElement>("#echo-lan")!;
const miragePinEl = document.querySelector<HTMLElement>("#mirage-pin")!;
const powerfistPinEl = document.querySelector<HTMLElement>("#powerfist-pin")!;
const miragePinExpiryEl = document.querySelector<HTMLElement>("#mirage-pin-expiry")!;
const powerfistPinExpiryEl = document.querySelector<HTMLElement>("#powerfist-pin-expiry")!;
const regenerateCodesBtn = document.querySelector<HTMLButtonElement>("#regenerate-codes")!;
const sendToMirageBtn = document.querySelector<HTMLButtonElement>("#send-to-mirage")!;
const sendMirageResultEl = document.querySelector<HTMLElement>("#send-mirage-result")!;
const relaySecretStatusEl = document.querySelector<HTMLElement>("#relay-secret-status")!;
const captureResultEl = document.querySelector<HTMLElement>("#capture-result")!;
const capturePreviewEl = document.querySelector<HTMLImageElement>("#capture-preview")!;
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

function formatCodeExpiry(expiresAt: string | null): string {
  if (!expiresAt) return "—";
  const ms = Date.parse(expiresAt) - Date.now();
  if (ms <= 0) return "expired";
  const minutes = Math.ceil(ms / 60_000);
  return `${minutes}m`;
}

function renderSpyCodes(codes: SpyCodes): void {
  const hosts = codes.lanHosts?.length ? codes.lanHosts.join(", ") : codes.echoHost;
  echoTeamIdEl.textContent = "";
  echoLanEl.textContent = `Direct LAN/Tailscale: ${codes.echoHost}:${codes.httpPort}${codes.lanHosts && codes.lanHosts.length > 1 ? ` (${hosts})` : ""}`;
  miragePinEl.textContent = codes.miragePin ?? "———";
  powerfistPinEl.textContent = codes.powerfistPin ?? "———";
  miragePinExpiryEl.textContent = codes.miragePin
    ? `expires in ${formatCodeExpiry(codes.mirageExpiresAt)}`
    : "No active code — tap New codes";
  powerfistPinExpiryEl.textContent = codes.powerfistPin
    ? `expires in ${formatCodeExpiry(codes.powerfistExpiresAt)}`
    : "No active code — tap New codes";
}

async function refreshSpyCodes(): Promise<void> {
  const codes = await api.getSpyCodes();
  if (codes.ok) {
    renderSpyCodes(codes);
  }
}

async function refreshRelaySecretStatus(): Promise<void> {
  const status = await api.getRelaySecretStatus();
  relaySecretStatusEl.textContent = status.configured
    ? "Cloud relay ready — keep Echo open; Mirage PWA finds you automatically."
    : "Cloud relay not ready.";
}

async function refreshPermissions(): Promise<void> {
  const perm = await api.checkPermissions();
  const micOk = perm.microphone !== false;
  if (perm.screenRecording && micOk) {
    permissionResultEl.textContent = "Screen Recording: granted · Microphone: ready";
    openScreenSettingsBtn.classList.remove("show");
  } else if (!perm.screenRecording) {
    permissionResultEl.textContent =
      perm.hint ?? "Screen Recording not granted — required before missions.";
    if (perm.platform === "macos") {
      openScreenSettingsBtn.classList.add("show");
    }
  } else {
    permissionResultEl.textContent =
      perm.hint ?? "Microphone not granted — required for Survey listening.";
    openScreenSettingsBtn.classList.remove("show");
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
    return "No Mirage linked yet — enter a Spy code on Mirage";
  }
  return lines.join("\n");
}

async function refreshStatus(): Promise<void> {
  const status = await api.getStatus();
  const mirageSummary = formatLinkedMirages(status);
  statusArmedEl.textContent = status.armed ? "ARMED" : "DISARMED";
  statusMiragesEl.textContent = mirageSummary;
  statusMiragesEl.classList.toggle("empty", mirageSummary.includes("No Mirage linked"));
  statusWsEl.textContent = status.wsStatus.toUpperCase();
  statusMissionsEl.textContent = String(status.missionsHandled);
  statusErrorEl.textContent = status.lastError?.trim() || "—";
}

document.querySelector<HTMLButtonElement>("#test-capture")!.addEventListener("click", async () => {
  const testCaptureBtn = document.querySelector<HTMLButtonElement>("#test-capture")!;
  testCaptureBtn.disabled = true;
  captureResultEl.textContent = "Capturing…";
  capturePreviewEl.classList.add("hidden");
  capturePreviewEl.removeAttribute("src");
  try {
    const result = await api.testCapture();
    if (result.ok) {
      captureResultEl.textContent = `OK ${result.width ?? "?"}×${result.height ?? "?"} · ~${result.pngBytes ?? 0} b64 chars`;
      if (result.pngBase64) {
        capturePreviewEl.src = `data:image/png;base64,${result.pngBase64}`;
        capturePreviewEl.classList.remove("hidden");
      }
    } else {
      captureResultEl.textContent = result.error ?? "Capture failed";
    }
  } catch (error) {
    captureResultEl.textContent =
      error instanceof Error ? error.message : "Capture failed — quit and reopen Echo Satellite.";
  } finally {
    testCaptureBtn.disabled = false;
    await refreshPermissions();
  }
});

openScreenSettingsBtn.addEventListener("click", async () => {
  await api.openScreenRecordingSettings();
});

document.querySelector<HTMLButtonElement>("#pair-url-btn")!.addEventListener("click", async () => {
  const url = document.querySelector<HTMLTextAreaElement>("#pair-url")!.value.trim();
  if (!url) {
    captureResultEl.textContent = "Paste the Mirage Echo QR URL in Advanced first.";
    return;
  }
  captureResultEl.textContent = "Pairing capture relay…";
  const result = await api.pairFromUrl(url);
  if (result.ok) {
    captureResultEl.textContent = "Capture relay armed — hide to tray when ready.";
    await refreshStatus();
  } else {
    captureResultEl.textContent = result.reason ?? "Pair failed";
  }
});

regenerateCodesBtn.addEventListener("click", async () => {
  regenerateCodesBtn.disabled = true;
  const codes = await api.regenerateSpyCodes();
  if (codes.ok) {
    renderSpyCodes(codes);
  }
  regenerateCodesBtn.disabled = false;
  await refreshStatus();
});

sendToMirageBtn.addEventListener("click", async () => {
  sendToMirageBtn.disabled = true;
  sendMirageResultEl.textContent = "Preparing…";
  const result = await api.sendToMirage();
  if (result.ok) {
    const pushed =
      "pushedToMirage" in result && typeof result.pushedToMirage === "number"
        ? ` · pushed to ${result.pushedToMirage} Mirage`
        : "";
    sendMirageResultEl.textContent = `${result.message} IP ${result.host}:${result.port} · code ${result.pin}${pushed}`;
  } else {
    sendMirageResultEl.textContent = result.reason;
  }
  sendToMirageBtn.disabled = false;
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
  void refreshSpyCodes();
});

api.onUpdateAvailable((result) => {
  renderUpdateStatus(result);
});

void refreshPermissions();
void refreshSpyCodes();
void refreshRelaySecretStatus();
void refreshStatus();
void refreshDiagnostics();
void refreshUpdateCheck();
installEchoSttBridge();
window.setInterval(() => {
  void refreshStatus();
  void refreshSpyCodes();
}, 5000);
