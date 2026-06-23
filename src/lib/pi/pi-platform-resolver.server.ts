import type { PiComputerUseBackend, PiPlatform } from "./pi-computer-use-types";
import { isSynapsePreferredOnWindows } from "./synapse/synapse-config.server";
import { isSynapseReady } from "./synapse/synapse-readiness.server";

export function resolvePiComputerUseBackend(platform: PiPlatform): PiComputerUseBackend {
  switch (platform) {
    case "windows":
      return isSynapsePreferredOnWindows() ? "synapse" : "windows-use";
    case "macos":
      return "pi-computer-use";
    default:
      return "none";
  }
}

export async function resolvePiComputerUseBackendAsync(
  platform: PiPlatform,
): Promise<PiComputerUseBackend> {
  switch (platform) {
    case "windows":
      if (isSynapsePreferredOnWindows() && (await isSynapseReady())) {
        return "synapse";
      }
      return "windows-use";
    case "macos":
      return "pi-computer-use";
    default:
      return "none";
  }
}
