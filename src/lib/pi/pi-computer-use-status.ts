import type {
  PiComputerUseBackend,
  PiComputerUseStatus,
  PiPlatform,
} from "./pi-computer-use-types";
import {
  resolvePiComputerUseBackend,
  resolvePiPlatform,
} from "./pi-platform-resolver";
import {
  checkWindowsUseBackend,
  isWindowsUseBridgeAvailable,
  PI_WINDOWS_USE_REMEDIATION,
} from "./windows/windows-use-python-bridge.server";

function buildCapabilities(
  backend: PiComputerUseBackend,
  ready: boolean,
): PiComputerUseStatus["capabilities"] {
  if (backend === "windows-use" && ready) {
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

function buildComputerUseState(
  backend: PiComputerUseBackend,
): PiComputerUseStatus["status"] {
  switch (backend) {
    case "windows-use":
      return buildWindowsReadiness().status;
    case "pi-computer-use":
      return "SCAFFOLD";
    default:
      return "UNAVAILABLE";
  }
}

export function buildPiComputerUseStatus(
  platform: PiPlatform = resolvePiPlatform(),
): PiComputerUseStatus {
  const backend = resolvePiComputerUseBackend(platform);
  const status = buildComputerUseState(backend);
  const windowsMeta = backend === "windows-use" ? buildWindowsReadiness() : null;

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
        ? PI_WINDOWS_USE_REMEDIATION
        : undefined,
    lastError: windowsMeta?.lastError,
  };
}

export function getPiComputerUseStatus(): PiComputerUseStatus {
  return buildPiComputerUseStatus();
}
