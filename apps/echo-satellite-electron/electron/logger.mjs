import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const logs = [];
let logPath = "";

/**
 * @param {import('electron').App} app
 */
export function beginSession(app, version) {
  logPath = path.join(app.getPath("logs"), "startup.log");
  log(`SESSION ${randomUUID()} v${version}`);
}

/** @param {string} message */
export function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  logs.push(line);
  if (logs.length > 400) logs.shift();
  void fs.mkdir(path.dirname(logPath), { recursive: true })
    .then(() => fs.appendFile(logPath, `${line}\n`, "utf8"))
    .catch(() => undefined);
}

/** @param {number} step @param {number} total @param {string} detail */
export function step(step, total, detail) {
  log(`[boot ${step}/${total}] ${detail}`);
}

export function getDiagnostics(version, platform, trayMode, captureNote = null) {
  return {
    version,
    platform,
    trayMode,
    logPath,
    sessionId: logs[0] ?? "unknown",
    previousSessionCrashed: false,
    previousSession: null,
    captureNote,
    logTail: logs.slice(-80).join("\n"),
    supportHint:
      "Startup is logged to startup.log. If capture fails on macOS, grant Screen Recording in System Settings.",
  };
}
