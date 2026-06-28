import { invoke } from "@tauri-apps/api/core";

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

const pairPortEl = document.querySelector<HTMLElement>("#pair-port")!;
const captureResultEl = document.querySelector<HTMLElement>("#capture-result")!;
const statusArmedEl = document.querySelector<HTMLElement>("#status-armed")!;
const statusWsEl = document.querySelector<HTMLElement>("#status-ws")!;
const statusMissionsEl = document.querySelector<HTMLElement>("#status-missions")!;
const statusErrorEl = document.querySelector<HTMLElement>("#status-error")!;

async function refreshStatus(): Promise<void> {
  const status = await invoke<SatelliteStatus>("get_status");
  pairPortEl.textContent = String(status.pairHttpPort);
  statusArmedEl.textContent = status.armed ? "ARMED" : "DISARMED";
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

void refreshStatus();
window.setInterval(() => {
  void refreshStatus();
}, 2000);
