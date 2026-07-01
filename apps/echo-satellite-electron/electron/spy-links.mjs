import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_PORTS = [3000, 3001, 8080];

/** @typedef {{ nodeId: string, pairedAt: string }} SpyMirageLink */

/** @returns {number[]} */
function candidatePorts() {
  const fromEnv = process.env.ECHO_CYBERDECK_HTTP_PORT?.trim();
  const ports = new Set(DEFAULT_PORTS);
  if (fromEnv) {
    for (const part of fromEnv.split(",")) {
      const port = Number(part.trim());
      if (Number.isFinite(port) && port > 0) {
        ports.add(port);
      }
    }
  }
  return [...ports];
}

/** @param {unknown} value @returns {value is SpyMirageLink} */
function isMirageLink(value) {
  if (!value || typeof value !== "object") return false;
  const record = /** @type {Record<string, unknown>} */ (value);
  return typeof record.nodeId === "string" && typeof record.pairedAt === "string";
}

/** @param {unknown} payload @returns {SpyMirageLink[]} */
function extractMirages(payload) {
  if (!payload || typeof payload !== "object") return [];
  const data = /** @type {Record<string, unknown>} */ (payload);
  if (Array.isArray(data.pairedMirages)) {
    return data.pairedMirages.filter(isMirageLink);
  }
  if (isMirageLink(data.pairedMirage)) {
    return [data.pairedMirage];
  }
  return [];
}

/** @returns {Promise<SpyMirageLink[] | null>} */
async function readStateFileMirages() {
  const statePath =
    process.env.ECHO_MIRAGE_SPY_PAIRING_STATE_PATH?.trim() ||
    path.join(process.cwd(), ".tmp", "echo-spy-pairing.json");
  try {
    const raw = JSON.parse(await fs.readFile(statePath, "utf8"));
    return extractMirages(raw);
  } catch {
    return null;
  }
}

/**
 * Poll local cyberdeck Spy pairing state for linked Mirages.
 * @returns {Promise<{ reachable: boolean, mirages: SpyMirageLink[] }>}
 */
export async function fetchSpyMirageLinks() {
  for (const port of candidatePorts()) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/survey/echo/codes`, {
        signal: AbortSignal.timeout(2000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.ok) {
        return { reachable: true, mirages: extractMirages(data) };
      }
    } catch {
      /* try next port */
    }
  }

  const fromFile = await readStateFileMirages();
  if (fromFile) {
    return { reachable: true, mirages: fromFile };
  }

  return { reachable: false, mirages: [] };
}
