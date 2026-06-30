const statusArmedEl = document.querySelector("#status-armed");
const statusWsEl = document.querySelector("#status-ws");
const captureResultEl = document.querySelector("#capture-result");
const capturePreviewEl = document.querySelector("#capture-preview");
const pairUrlEl = document.querySelector("#pair-url");

async function refreshStatus() {
  const status = await chrome.runtime.sendMessage({ type: "echo-capture-get-status" });
  statusArmedEl.textContent = status.armed ? "ARMED" : "DISARMED";
  statusWsEl.textContent = `WebSocket: ${String(status.wsStatus ?? "disconnected").toUpperCase()}`;
}

document.querySelector("#pair-btn").addEventListener("click", async () => {
  captureResultEl.textContent = "Pairing…";
  const result = await chrome.runtime.sendMessage({
    type: "echo-capture-pair",
    url: pairUrlEl.value,
  });
  if (result.ok) {
    captureResultEl.textContent = "Paired and armed.";
    await refreshStatus();
  } else {
    captureResultEl.textContent = result.reason ?? "Pair failed";
  }
});

document.querySelector("#test-capture").addEventListener("click", async () => {
  captureResultEl.textContent = "Capturing active tab…";
  capturePreviewEl.classList.add("hidden");
  capturePreviewEl.removeAttribute("src");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.windowId) {
      captureResultEl.textContent = "No active tab.";
      return;
    }
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    const img = new Image();
    img.onload = () => {
      captureResultEl.textContent = `OK ${img.naturalWidth}×${img.naturalHeight} · active tab`;
      capturePreviewEl.src = dataUrl;
      capturePreviewEl.classList.remove("hidden");
    };
    img.onerror = () => {
      captureResultEl.textContent = "Could not load capture preview.";
    };
    img.src = dataUrl;
  } catch (error) {
    captureResultEl.textContent = error instanceof Error ? error.message : "Capture failed";
  }
});

document.querySelector("#disarm").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "echo-capture-disarm" });
  await refreshStatus();
  captureResultEl.textContent = "Disarmed.";
});

void refreshStatus();
