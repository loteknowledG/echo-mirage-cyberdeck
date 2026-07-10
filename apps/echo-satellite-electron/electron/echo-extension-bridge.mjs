/**
 * Localhost bridge between echo-electron (pair server) and echo-extension (Chrome).
 * Mirage queues commands; extension polls and posts results.
 */

import * as logger from "./logger.mjs";

const DEFAULT_WAIT_MS = 12_000;
const POLL_STALE_MS = 45_000;

/** @typedef {{ id: string, kind: "list-tabs" | "capture-tab" | "capture-active", tabId?: number, createdAt: number, settle: (value: object) => void }} PendingCommand */

/** @type {Map<string, PendingCommand>} */
const pending = new Map();

/** @type {{ at: number } | null} */
let lastExtensionPoll = null;

function makeId() {
  return `ext-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getEchoExtensionBridgeStatus() {
  const connected =
    lastExtensionPoll != null && Date.now() - lastExtensionPoll.at < POLL_STALE_MS;
  return {
    connected,
    pendingCount: pending.size,
    lastPollAt: lastExtensionPoll?.at ?? null,
  };
}

/**
 * @param {"list-tabs" | "capture-tab" | "capture-active"} kind
 * @param {{ tabId?: number, waitMs?: number }} [options]
 */
export function enqueueEchoExtensionCommand(kind, options = {}) {
  const waitMs = options.waitMs ?? DEFAULT_WAIT_MS;
  const id = makeId();

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (!pending.has(id)) return;
      pending.delete(id);
      reject(
        new Error(
          "echo-extension did not respond — is it loaded in Chrome and polling echo-electron?",
        ),
      );
    }, waitMs);

    /** @type {PendingCommand} */
    const entry = {
      id,
      kind,
      tabId: options.tabId,
      createdAt: Date.now(),
      settle: (value) => {
        clearTimeout(timer);
        pending.delete(id);
        resolve(value);
      },
    };
    pending.set(id, entry);
    logger.log(`echo-extension-bridge: queued ${kind} (${id})`);
  });
}

/** Extension poll — returns oldest pending command or null. */
export function takeEchoExtensionPendingCommand() {
  lastExtensionPoll = { at: Date.now() };
  const next = [...pending.values()].sort((a, b) => a.createdAt - b.createdAt)[0];
  if (!next) return null;
  return {
    id: next.id,
    kind: next.kind,
    tabId: next.tabId ?? null,
  };
}

/**
 * @param {string} id
 * @param {object} result
 */
export function completeEchoExtensionCommand(id, result) {
  const entry = pending.get(id);
  if (!entry) {
    return { ok: false, reason: "Unknown or expired command id." };
  }
  entry.settle(result && typeof result === "object" ? result : { ok: false, reason: "Empty result." });
  return { ok: true };
}
