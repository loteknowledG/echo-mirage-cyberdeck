import fs from "node:fs";
import {
  CALYX_PI_REMEDIATION,
  isCalyxIntegrationEnabled,
  resolveCalyxHome,
  resolveCalyxMcpBinary,
  resolveCalyxVaultName,
} from "./calyx-config.server";
import { probeCalyxMcpReadiness } from "./calyx-readiness.server";
import type { CalyxStatus } from "./calyx-types";

export async function getCalyxStatus(): Promise<CalyxStatus> {
  const enabled = isCalyxIntegrationEnabled();
  const binaryPath = resolveCalyxMcpBinary();
  const calyxHome = resolveCalyxHome();
  const vault = resolveCalyxVaultName();

  if (!enabled) {
    const missingBinary = !fs.existsSync(binaryPath);
    return {
      enabled: false,
      status: missingBinary ? "NOT_INSTALLED" : "DISABLED",
      vault,
      calyxHome,
      binaryPath,
      remediation: CALYX_PI_REMEDIATION,
    };
  }

  const probe = await probeCalyxMcpReadiness();
  return {
    enabled: true,
    status: probe.status,
    vault,
    calyxHome,
    binaryPath,
    toolCount: probe.toolCount,
    version: probe.version,
    remediation: probe.ok ? undefined : probe.remediation,
    lastError: probe.ok ? undefined : probe.message,
  };
}
