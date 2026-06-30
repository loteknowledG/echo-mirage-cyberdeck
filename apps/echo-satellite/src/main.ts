import { invoke } from "@tauri-apps/api/core";

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

type PermissionStatus = {
  platform: string;
  screenRecording: boolean;
  hint?: string | null;
};

type SessionRecord = {
  sessionId: string;
  version: string;
  platform: string;
  trayMode: string;
  startedAtUnix: number;
  status: string;
  lastMessage?: string | null;
};

type DiagnosticsReport = {
  version: string;
  platform: string;
  trayMode: string;
  logPath: string;
  sessionId: string;
  previousSessionCrashed: boolean;
  previousSession?: SessionRecord | null;
  logTail: string;
  supportHint: string;
};

const pairPortEl = document.querySelector<HTMLElement>("#pair-port")!;
const captureResultEl = document.querySelector<HTMLElement>("#capture-result")!;
const permissionResultEl = document.querySelector<HTMLElement>("#permission-result")!;
const openScreenSettingsBtn = document.querySelector<HTMLButtonElement>("#open-screen-settings")!;
const statusArmedEl = document.querySelector<HTMLElement>("#status-armed")!;
const statusWsEl = document.querySelector<HTMLElement>("#status-ws")!;
const statusMissionsEl = document.querySelector<HTMLElement>("#status-missions")!;
const statusMiragesEl = document.querySelector<HTMLElement>("#status-mirages")!;
const statusErrorEl = document.querySelector<HTMLElement>("#status-error")!;
const crashBannerEl = document.querySelector<HTMLElement>("#crash-banner")!;
const crashBannerDetailEl = document.querySelector<HTMLElement>("#crash-banner-detail")!;
const diagHintEl = document.querySelector<HTMLElement>("#diag-hint")!;
const diagVersionEl = document.querySelector<HTMLElement>("#diag-version")!;
const diagSessionEl = document.querySelector<HTMLElement>("#diag-session")!;
const diagModeEl = document.querySelector<HTMLElement>("#diag-mode")!;
const diagLogPathEl = document.querySelector<HTMLElement>("#diag-log-path")!;
const diagLogTailEl = document.querySelector<HTMLElement>("#diag-log-tail")!;

function formatDiagnostics(report: DiagnosticsReport): string {
  return [
    `Echo Satellite diagnostics`,
    `version: ${report.version}`,
    `platform: ${report.platform}`,
    `trayMode: ${report.trayMode}`,
    `sessionId: ${report.sessionId}`,
    `logPath: ${report.logPath}`,
    `previousSessionCrashed: ${report.previousSessionCrashed}`,
    report.previousSession
      ? `previousSession: ${JSON.stringify(report.previousSession)}`
      : "previousSession: null",
    "",
    "--- startup.log (tail) ---",
    report.logTail,
  ].join("\n");
}

async function refreshDiagnostics(): Promise<DiagnosticsReport> {
  const report = await invoke<DiagnosticsReport>("get_diagnostics");

  diagHintEl.textContent = report.supportHint;
  diagVersionEl.textContent = `${report.version} (${report.platform})`;
  diagSessionEl.textContent = report.sessionId;
  diagModeEl.textContent = report.trayMode;
  diagLogPathEl.textContent = report.logPath;
  diagLogTailEl.textContent = report.logTail || "(empty)";

  if (report.previousSessionCrashed && report.previousSession) {
    crashBannerEl.classList.remove("hidden");
    crashBannerDetailEl.textContent =
      `Last session ${report.previousSession.sessionId} stopped at: ` +
      `${report.previousSession.lastMessage ?? "unknown"}. See Diagnostics below.`;
  } else {
    crashBannerEl.classList.add("hidden");
  }

  return report;
}

async function refreshPermissions(): Promise<void> {
  const perm = await invoke<PermissionStatus>("check_permissions");
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
  const status = await invoke<SatelliteStatus>("get_status");
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
  const result = await invoke<TestCaptureResult>("test_capture");
  if (result.ok) {
    captureResultEl.textContent = `OK ${result.width ?? "?"}×${result.height ?? "?"} · ~${result.pngBytes ?? 0} b64 chars`;
  } else {
    captureResultEl.textContent = result.error ?? "Capture failed";
  }
  await refreshPermissions();
});

openScreenSettingsBtn.addEventListener("click", async () => {
  await invoke("open_screen_recording_settings");
});

document.querySelector<HTMLButtonElement>("#pair-url-btn")!.addEventListener("click", async () => {
  const url = document.querySelector<HTMLTextAreaElement>("#pair-url")!.value.trim();
  if (!url) {
    captureResultEl.textContent = "Paste the Mirage Echo QR URL first.";
    return;
  }
  captureResultEl.textContent = "Pairing…";
  const result = await invoke<PairResult>("pair_from_url", { capturePairUrl: url });
  if (result.ok) {
    captureResultEl.textContent = "Paired and armed — satellite hidden to tray.";
    await refreshStatus();
  } else {
    captureResultEl.textContent = result.reason ?? "Pair failed";
  }
});

document.querySelector<HTMLButtonElement>("#hide-tray")!.addEventListener("click", async () => {
  await invoke("hide_to_tray");
});

document.querySelector<HTMLButtonElement>("#disarm")!.addEventListener("click", async () => {
  await invoke("disarm");
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

void refreshPermissions();
void refreshStatus();
void refreshDiagnostics();
window.setInterval(() => {
  void refreshStatus();
  void refreshDiagnostics();
}, 5000);
