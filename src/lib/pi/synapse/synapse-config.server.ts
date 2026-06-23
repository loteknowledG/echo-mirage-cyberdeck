import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const SYNAPSE_MCP_URL =
  process.env.SYNAPSE_MCP_URL?.trim() || "http://127.0.0.1:7700/mcp";

export const SYNAPSE_HEALTH_URL =
  process.env.SYNAPSE_HEALTH_URL?.trim() ||
  SYNAPSE_MCP_URL.replace(/\/mcp\/?$/, "/health");

const TOKEN_FILE = path.join(
  process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
  "synapse",
  "token.txt",
);

export function readSynapseBearerToken(): string | null {
  const fromEnv = process.env.SYNAPSE_BEARER_TOKEN?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  try {
    return fs.readFileSync(TOKEN_FILE, "utf8").trim() || null;
  } catch {
    return null;
  }
}

export function isSynapsePreferredOnWindows(): boolean {
  if (process.platform !== "win32") {
    return false;
  }
  const override = process.env.PI_COMPUTER_USE_BACKEND?.trim().toLowerCase();
  if (override === "windows-use") {
    return false;
  }
  return override !== "none";
}

export const SYNAPSE_PI_REMEDIATION =
  "Start the Synapse daemon (synapse-mcp --mode http --bind 127.0.0.1:7700) and ensure SYNAPSE_BEARER_TOKEN or %APPDATA%\\synapse\\token.txt is set.";
