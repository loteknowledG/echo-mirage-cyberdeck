import { isMirageTabUrl } from "./mirage-targets.js";

const DELIVER_MESSAGE = { type: "SURVEY_EXTENSION_DELIVER" };

/** Self-contained — injected into arbitrary tabs (no closure imports). */
function capturePageSnapshotInTab() {
  const maxChars = 6000;
  const body = document.body;
  const rawText = body ? body.innerText || body.textContent || "" : "";
  const pageText = rawText.replace(/\s+/g, " ").trim().slice(0, maxChars);
  return {
    url: window.location.href,
    title: document.title || "",
    pageText,
    capturedAt: new Date().toISOString(),
    source: "echo-mirage-survey-extension",
  };
}

async function captureActiveTabSnapshot(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: capturePageSnapshotInTab,
  });
  if (!result || typeof result.url !== "string") {
    throw new Error("Page capture returned no data.");
  }
  if (!result.pageText?.trim()) {
    const fallback = [result.title, result.url].filter((part) => part?.trim()).join(" · ");
    result.pageText = fallback || result.url;
  }
  return result;
}

async function findMirageTabs() {
  const tabs = await chrome.tabs.query({});
  return tabs.filter((tab) => isMirageTabUrl(tab.url) && tab.id != null);
}

async function deliverToMirageTabs(payload) {
  const mirageTabs = await findMirageTabs();
  if (mirageTabs.length === 0) {
    return { ok: false, reason: "Open Echo Mirage cyberdeck in a tab first." };
  }

  let delivered = 0;
  const errors = [];
  for (const tab of mirageTabs) {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        ...DELIVER_MESSAGE,
        payload,
      });
      if (response?.ok) delivered += 1;
      else errors.push(response?.reason ?? "Mirage tab rejected payload.");
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "Mirage tab unreachable.");
    }
  }

  if (delivered === 0) {
    return {
      ok: false,
      reason: errors[0] ?? "Could not reach Mirage content script — reload the cyberdeck tab.",
    };
  }

  return {
    ok: true,
    delivered,
    mirageTabs: mirageTabs.length,
    title: payload.title,
    url: payload.url,
  };
}

export async function captureAndDeliverActiveTab() {
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!active?.id) {
    return { ok: false, reason: "No active tab." };
  }
  if (isMirageTabUrl(active.url)) {
    return {
      ok: false,
      reason: "Switch to the target page tab first — not the Mirage cyberdeck tab.",
    };
  }

  const payload = await captureActiveTabSnapshot(active.id);
  return deliverToMirageTabs(payload);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "SURVEY_EXTENSION_CAPTURE_ACTIVE") {
    void captureAndDeliverActiveTab().then(sendResponse);
    return true;
  }
  return false;
});

chrome.runtime.onMessageExternal.addListener((message, _sender, sendResponse) => {
  if (message?.type === "SURVEY_EXTENSION_CAPTURE_ACTIVE") {
    void captureAndDeliverActiveTab().then(sendResponse);
    return true;
  }
  return false;
});
