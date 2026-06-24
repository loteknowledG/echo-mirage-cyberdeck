import {
  CALYX_PI_REMEDIATION,
  isCalyxIntegrationEnabled,
  resolveCalyxHome,
  resolveCalyxMcpBinary,
} from "./calyx-config.server";
import { getCalyxMcpClient } from "./calyx-mcp-client.server";
import type { CalyxRuntimeStatus } from "./calyx-types";

export type CalyxReadinessProbe = {
  ok: boolean;
  status: CalyxRuntimeStatus;
  binaryPath: string;
  calyxHome: string;
  toolCount?: number;
  version?: string;
  message?: string;
  remediation?: string;
};

export async function probeCalyxMcpReadiness(): Promise<CalyxReadinessProbe> {
  const binaryPath = resolveCalyxMcpBinary();
  const calyxHome = resolveCalyxHome();

  if (!isCalyxIntegrationEnabled()) {
    return {
      ok: false,
      status: "DISABLED",
      binaryPath,
      calyxHome,
      remediation: CALYX_PI_REMEDIATION,
      message: "Calyx integration disabled or calyx-mcp binary missing",
    };
  }

  try {
    const client = getCalyxMcpClient();
    await client.initialize();
    const tools = await client.listTools();

    return {
      ok: true,
      status: "READY",
      binaryPath,
      calyxHome,
      toolCount: tools.length,
      version: client.getServerVersion() ?? "0.1.0",
      message: `calyx_ok tools=${tools.length}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      status: "FAILED",
      binaryPath,
      calyxHome,
      message,
      remediation: CALYX_PI_REMEDIATION,
    };
  }
}
