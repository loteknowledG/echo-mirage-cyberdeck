import type {
  PiComputerUseBackend,
  PiComputerUseStatus,
  PiPlatform,
} from "./pi-computer-use-types";
import {
  resolvePiComputerUseBackend,
  resolvePiPlatform,
} from "./pi-platform-resolver";

function buildCapabilities(
  backend: PiComputerUseBackend,
): PiComputerUseStatus["capabilities"] {
  if (backend === "windows-use") {
    return {
      screenshot: true,
      mouse: true,
      keyboard: true,
      scroll: true,
    };
  }
  return {
    screenshot: false,
    mouse: false,
    keyboard: false,
    scroll: false,
  };
}

function buildComputerUseState(
  backend: PiComputerUseBackend,
): PiComputerUseStatus["computerUse"] {
  switch (backend) {
    case "windows-use":
      return "READY";
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
  return {
    actor: "pi",
    platform,
    backend,
    computerUse: buildComputerUseState(backend),
    capabilities: buildCapabilities(backend),
  };
}

export function getPiComputerUseStatus(): PiComputerUseStatus {
  return buildPiComputerUseStatus();
}
