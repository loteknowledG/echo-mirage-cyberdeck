import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DEFAULT_VAULT_NAME = "echo-mirage";

export function resolveCalyxHome(): string {
  const fromEnv = process.env.CALYX_HOME?.trim();
  if (fromEnv) {
    return path.resolve(fromEnv);
  }
  return path.resolve(process.cwd(), ".calyx");
}

export function resolveCalyxVaultName(): string {
  const fromEnv = process.env.CALYX_VAULT_NAME?.trim();
  return fromEnv || DEFAULT_VAULT_NAME;
}

export function resolveCalyxMcpBinary(): string {
  const fromEnv = process.env.CALYX_MCP_BINARY?.trim();
  if (fromEnv) {
    return path.resolve(fromEnv);
  }
  const cargoBin = path.join(os.homedir(), ".cargo", "bin", "calyx-mcp.exe");
  if (process.platform === "win32" && fs.existsSync(cargoBin)) {
    return cargoBin;
  }
  const cargoBinUnix = path.join(os.homedir(), ".cargo", "bin", "calyx-mcp");
  if (fs.existsSync(cargoBinUnix)) {
    return cargoBinUnix;
  }
  return process.platform === "win32" ? cargoBin : cargoBinUnix;
}

export function isCalyxIntegrationEnabled(): boolean {
  const raw = process.env.CALYX_ENABLED?.trim().toLowerCase();
  if (raw === "0" || raw === "false") return false;
  if (raw === "1" || raw === "true") return true;
  return fs.existsSync(resolveCalyxMcpBinary());
}

export const CALYX_PI_REMEDIATION =
  "Install calyx-mcp (cargo install --path crates/calyx-mcp from ChrisRoyse/Calyx) and set CALYX_HOME or allow .calyx/ under the repo.";
