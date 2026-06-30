const STORAGE_KEY = "echo-capture-credentials";
const NODE_ID_KEY = "echo-capture-node-id";

/** @typedef {{ wsHost: string, wsPort: number, captureToken: string, nodeId: string }} CaptureCredentials */

/** @returns {Promise<string>} */
async function getOrCreateNodeId() {
  const stored = (await chrome.storage.local.get(NODE_ID_KEY))[NODE_ID_KEY];
  if (typeof stored === "string" && stored.trim()) return stored.trim();
  const created = crypto.randomUUID();
  await chrome.storage.local.set({ [NODE_ID_KEY]: created });
  return created;
}

/** @returns {Promise<CaptureCredentials | null>} */
export async function loadCredentials() {
  const stored = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY];
  if (!stored || typeof stored !== "object") return null;
  const creds = /** @type {CaptureCredentials} */ (stored);
  if (!creds.wsHost || !creds.captureToken || !creds.nodeId || !creds.wsPort) return null;
  return creds;
}

/** @param {CaptureCredentials} creds */
export async function saveCredentials(creds) {
  await chrome.storage.local.set({ [STORAGE_KEY]: creds });
}

export async function clearCredentials() {
  await chrome.storage.local.remove(STORAGE_KEY);
}

/**
 * @param {string} capturePairUrl
 * @returns {Promise<{ ok: true, creds: CaptureCredentials } | { ok: false, reason: string }>}
 */
export async function pairFromCaptureUrl(capturePairUrl) {
  let parsed;
  try {
    parsed = new URL(capturePairUrl.trim());
  } catch {
    return { ok: false, reason: "Invalid capture pair URL." };
  }

  const pairId = parsed.searchParams.get("pairId")?.trim();
  const pairSecret = parsed.searchParams.get("pairSecret")?.trim();
  const mirageHost = parsed.searchParams.get("mirageHost")?.trim();
  const mirageHttpPort = Number(parsed.searchParams.get("mirageHttpPort"));
  if (!pairId || !pairSecret || !mirageHost || !Number.isFinite(mirageHttpPort)) {
    return { ok: false, reason: "URL missing pairId, pairSecret, mirageHost, or mirageHttpPort." };
  }

  const nodeId = await getOrCreateNodeId();
  const response = await fetch(`http://${mirageHost}:${mirageHttpPort}/api/powerfist/pair/capture`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pairId, pairSecret, nodeId, label: "echo" }),
  });

  const payload = await response.json();
  if (!payload?.ok) {
    return { ok: false, reason: payload?.reason ?? "Pair rejected by Mirage." };
  }

  const creds = {
    nodeId: payload.nodeId ?? nodeId,
    wsHost: payload.wsHost ?? mirageHost,
    wsPort: Number(payload.wsPort),
    captureToken: String(payload.captureToken ?? "").trim(),
  };
  if (!creds.captureToken || !Number.isFinite(creds.wsPort) || creds.wsPort <= 0) {
    return { ok: false, reason: "Pair response missing capture token or ws port." };
  }

  await saveCredentials(creds);
  return { ok: true, creds };
}
