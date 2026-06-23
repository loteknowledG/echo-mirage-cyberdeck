import type { PiPlatform } from "./pi-computer-use-types";

export function resolvePiPlatform(platform: NodeJS.Platform = process.platform): PiPlatform {
  switch (platform) {
    case "win32":
      return "windows";
    case "darwin":
      return "macos";
    case "linux":
      return "linux";
    default:
      return "unsupported";
  }
}

export function formatPiPlatformLabel(platform: PiPlatform): string {
  switch (platform) {
    case "windows":
      return "Windows";
    case "macos":
      return "macOS";
    case "linux":
      return "Linux";
    default:
      return "Unsupported";
  }
}
