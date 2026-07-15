import { isMirageTabUrl } from "./mirage-targets.js";

const DELIVER_MESSAGE = { type: "SURVEY_EXTENSION_DELIVER" };
const PAGE_CONTEXT_EVENT = "echo-mirage:survey-extension-page-context";
const ECHO_ELECTRON_BASE = "http://127.0.0.1:3050";
const POLL_MS = 900;

/** @type {Set<string>} */
const inFlightCommandIds = new Set();

/** Self-contained — injected into arbitrary tabs (no closure imports). */
function capturePageSnapshotInTab() {
  const maxChars = 12000;
  const host = (window.location.hostname || "").toLowerCase();

  function normalizePageText(raw) {
    return String(raw || "")
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, maxChars);
  }

  function extractFocusedChallengeText() {
    if (!host.includes("hackerrank")) return "";
    const selectors = [
      '[data-attr2="problem-statement"]',
      ".challenge-body-html",
      "#content .challenge-text",
      ".problem-statement",
      '[class*="challenge-body"]',
      '[class*="ProblemStatement"]',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      const text = el && (el.innerText || el.textContent || "");
      if (text && text.trim().length > 80) return text;
    }
    return "";
  }

  const focused =
    extractFocusedChallengeText() ||
    (document.body ? document.body.innerText || document.body.textContent || "" : "");
  const pageText = normalizePageText(focused);

  return {
    url: window.location.href,
    title: document.title || "",
    pageText,
    capturedAt: new Date().toISOString(),
    source: "echo-extension",
  };
}

function dispatchPageContextInMainWorld(payload, eventName) {
  window.dispatchEvent(new CustomEvent(eventName, { detail: payload }));
  window.postMessage(
    {
      source: "echo-extension",
      type: eventName,
      payload,
    },
    window.location.origin,
  );
  return true;
}

function hostnamePathDistinguisher(urlString) {
  try {
    const url = new URL(urlString);
    const path = url.pathname.length > 40 ? `${url.pathname.slice(0, 39)}…` : url.pathname;
    return `${url.hostname}${path === "/" ? "" : path}`;
  } catch {
    return urlString.slice(0, 48);
  }
}

/**
 * Left→right #1…n for duplicate titles; optional Wn when multiple windows.
 * @param {chrome.tabs.Tab[]} tabs
 * @param {Map<number, number>} windowOrdinal
 */
function buildTabOptions(tabs, windowOrdinal) {
  const sorted = [...tabs].sort((a, b) => {
    const wa = a.windowId ?? 0;
    const wb = b.windowId ?? 0;
    if (wa !== wb) return wa - wb;
    return (a.index ?? 0) - (b.index ?? 0);
  });

  /** @type {Map<string, number>} */
  const titleCounts = new Map();
  for (const tab of sorted) {
    const title = (tab.title || "").trim() || "(untitled)";
    titleCounts.set(title, (titleCounts.get(title) ?? 0) + 1);
  }

  /** @type {Map<string, number>} */
  const titleSeen = new Map();
  const multiWindow = new Set(sorted.map((t) => t.windowId)).size > 1;

  return sorted
    .filter((tab) => tab.id != null && !isMirageTabUrl(tab.url))
    .map((tab) => {
      const title = (tab.title || "").trim() || "(untitled)";
      const base = hostnamePathDistinguisher(tab.url || "");
      const dupTotal = titleCounts.get(title) ?? 1;
      let dupSuffix = "";
      if (dupTotal > 1) {
        const n = (titleSeen.get(title) ?? 0) + 1;
        titleSeen.set(title, n);
        dupSuffix = ` · #${n}`;
      }
      const winId = tab.windowId ?? 0;
      const winTag =
        multiWindow && windowOrdinal.has(winId) ? `W${windowOrdinal.get(winId)} · ` : "";
      const distinguisher = `${winTag}${base}${dupSuffix}`;
      return {
        tabId: tab.id,
        title,
        url: tab.url || "",
        distinguisher,
        label: `${title} — ${distinguisher}`,
        windowId: winId,
        index: tab.index ?? 0,
      };
    });
}

async function listCaptureTabs() {
  const tabs = await chrome.tabs.query({});
  const windowIds = [...new Set(tabs.map((t) => t.windowId).filter((id) => id != null))].sort(
    (a, b) => a - b,
  );
  /** @type {Map<number, number>} */
  const windowOrdinal = new Map();
  windowIds.forEach((id, i) => windowOrdinal.set(id, i + 1));
  return buildTabOptions(tabs, windowOrdinal);
}

async function captureTabSnapshot(tabId) {
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

async function deliverViaMainWorld(tabId, payload) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: dispatchPageContextInMainWorld,
    args: [payload, PAGE_CONTEXT_EVENT],
  });
  return Boolean(result);
}

async function deliverViaContentScript(tabId, payload) {
  const response = await chrome.tabs.sendMessage(tabId, {
    ...DELIVER_MESSAGE,
    payload,
  });
  return Boolean(response?.ok);
}

async function deliverToMirageTabs(payload) {
  const mirageTabs = await findMirageTabs();
  if (mirageTabs.length === 0) {
    return { ok: false, reason: "Open mirage-browser cyberdeck in a tab first (Phase 0 fallback)." };
  }

  let delivered = 0;
  const errors = [];
  for (const tab of mirageTabs) {
    try {
      const mainOk = await deliverViaMainWorld(tab.id, payload);
      if (mainOk) {
        delivered += 1;
        continue;
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "MAIN-world inject failed.");
    }

    try {
      const contentOk = await deliverViaContentScript(tab.id, payload);
      if (contentOk) delivered += 1;
      else errors.push("Mirage tab rejected payload.");
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "Mirage tab unreachable.");
    }
  }

  if (delivered === 0) {
    return {
      ok: false,
      reason: errors[0] ?? "Could not reach mirage-browser — reload the cyberdeck tab.",
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

/** Active tab snapshot for Phase 0 deliver or Phase 1 bridge (no Mirage tab required). */
export async function captureActiveTabSnapshot() {
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!active?.id) {
    return { ok: false, reason: "No active tab." };
  }
  if (isMirageTabUrl(active.url)) {
    return {
      ok: false,
      reason: "Switch to the target page tab first — not the mirage-browser tab.",
    };
  }

  const snapshot = await captureTabSnapshot(active.id);
  return { ok: true, snapshot };
}

export async function captureAndDeliverActiveTab() {
  const captured = await captureActiveTabSnapshot();
  if (!captured.ok) return captured;
  return deliverToMirageTabs(captured.snapshot);
}

async function postExtensionResult(id, result) {
  await fetch(`${ECHO_ELECTRON_BASE}/api/survey/echo/extension/result`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, result }),
  });
}

async function handleBridgeCommand(command) {
  if (!command?.id || inFlightCommandIds.has(command.id)) return;
  inFlightCommandIds.add(command.id);
  try {
    if (command.kind === "list-tabs") {
      const tabs = await listCaptureTabs();
      await postExtensionResult(command.id, { ok: true, tabs });
      return;
    }
    if (command.kind === "capture-tab") {
      const tabId = Number(command.tabId);
      if (!Number.isFinite(tabId)) {
        await postExtensionResult(command.id, { ok: false, reason: "tabId missing." });
        return;
      }
      const snapshot = await captureTabSnapshot(tabId);
      await postExtensionResult(command.id, {
        ok: true,
        message: `echo-extension captured · ${snapshot.title || snapshot.url}`,
        snapshot,
      });
      return;
    }
    if (command.kind === "capture-active") {
      const captured = await captureActiveTabSnapshot();
      if (!captured.ok) {
        await postExtensionResult(command.id, {
          ok: false,
          reason: captured.reason ?? "Active tab capture failed.",
        });
        return;
      }
      const snapshot = captured.snapshot;
      await postExtensionResult(command.id, {
        ok: true,
        message: `echo-extension captured active · ${snapshot.title || snapshot.url}`,
        snapshot,
      });
      return;
    }
    await postExtensionResult(command.id, { ok: false, reason: `Unknown kind: ${command.kind}` });
  } catch (err) {
    await postExtensionResult(command.id, {
      ok: false,
      reason: err instanceof Error ? err.message : "echo-extension command failed.",
    });
  } finally {
    inFlightCommandIds.delete(command.id);
  }
}

async function pollEchoElectronBridge() {
  try {
    const res = await fetch(`${ECHO_ELECTRON_BASE}/api/survey/echo/extension/poll`, {
      cache: "no-store",
    });
    if (!res.ok) return;
    const payload = await res.json();
    if (payload?.command) {
      await handleBridgeCommand(payload.command);
    }
  } catch {
    // echo-electron not running — silent until available
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "SURVEY_EXTENSION_CAPTURE_ACTIVE") {
    void captureAndDeliverActiveTab().then(sendResponse);
    return true;
  }
  if (message?.type === "ECHO_EXTENSION_LIST_TABS") {
    void listCaptureTabs()
      .then((tabs) => sendResponse({ ok: true, tabs }))
      .catch((err) =>
        sendResponse({ ok: false, reason: err instanceof Error ? err.message : "list failed" }),
      );
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

void pollEchoElectronBridge();
setInterval(() => {
  void pollEchoElectronBridge();
}, POLL_MS);

try {
  void chrome.alarms.create("echo-electron-poll", { periodInMinutes: 0.05 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "echo-electron-poll") {
      void pollEchoElectronBridge();
    }
  });
} catch {
  /* alarms optional */
}
