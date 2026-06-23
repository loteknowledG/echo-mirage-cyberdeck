import type {
  PiComputerUseBackend,
  PiComputerUseStatus,
  PiPlatform,
} from "./pi-computer-use-types";
import {
  resolvePiComputerUseBackendAsync,
  resolvePiPlatform,
} from "./pi-platform-resolver";
import { getSynapseAdapterStatus } from "./synapse/synapse-adapter";
import {
  checkWindowsUseBackend,
  isWindowsUseBridgeAvailable,
  PI_WINDOWS_USE_REMEDIATION,
} from "./windows/windows-use-python-bridge.server";

function buildCapabilities(
  backend: PiComputerUseBackend,
  ready: boolean,
): PiComputerUseStatus["capabilities"] {
  if ((backend === "synapse" || backend === "windows-use") && ready) {
    return {
      screenshot: true,
      activeWindow: true,
      mouse: true,
      keyboard: true,
      scroll: true,
    };
  }
  if (backend === "pi-computer-use") {
    return {
      screenshot: false,
      activeWindow: false,
      mouse: false,
      keyboard: false,
      scroll: false,
    };
  }
  return {
    screenshot: false,
    activeWindow: false,
    mouse: false,
    keyboard: false,
    scroll: false,
  };
}

function buildWindowsReadiness(): {
  status: PiComputerUseStatus["status"];
  lastError?: string;
} {
  if (process.platform !== "win32") {
    return { status: "UNAVAILABLE" };
  }
  if (!isWindowsUseBridgeAvailable()) {
    return { status: "NOT_INSTALLED" };
  }
  const check = checkWindowsUseBackend();
  if (check.ok) {
    return { status: "READY" };
  }
  return {
    status: "FAILED",
    lastError: check.receipt.error ?? check.spawnError,
  };
}

async function buildComputerUseState(
  backend: PiComputerUseBackend,
): Promise<PiComputerUseStatus["status"]> {
  switch (backend) {
    case "synapse": {
      const status = await getSynapseAdapterStatus();
      return status.status;
    }
    case "windows-use":
      return buildWindowsReadiness().status;
    case "pi-computer-use":
      return "SCAFFOLD";
    default:
      return "UNAVAILABLE";
  }
}

export async function buildPiComputerUseStatus(
  platform: PiPlatform = resolvePiPlatform(),
): Promise<PiComputerUseStatus> {
  const backend = await resolvePiComputerUseBackendAsync(platform);
  const status = await buildComputerUseState(backend);
  const windowsMeta = backend === "windows-use" ? buildWindowsReadiness() : null;
  const synapseMeta = backend === "synapse" ? await getSynapseAdapterStatus() : null;

  return {
    actor: "pi",
    platform,
    hostPlatform: platform,
    backend,
    status,
    computerUse: status,
    capabilities: buildCapabilities(backend, status === "READY"),
    remediation:
      status === "NOT_INSTALLED" || status === "FAILED"
        ? backend === "synapse"
          ? synapseMeta?.remediation
          : PI_WINDOWS_USE_REMEDIATION
        : undefined,
    lastError:
      backend === "synapse"
        ? synapseMeta?.lastError
        : windowsMeta?.lastError,
  };
}

export async function getPiComputerUseStatus(): Promise<PiComputerUseStatus> {
  return buildPiComputerUseStatus();
}
