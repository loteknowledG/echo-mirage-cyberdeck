import type { PiPlatform } from "./pi-computer-use-types";

/** Browser/Electron operator platform (where the deck UI runs). */
export function detectOperatorPlatform(): PiPlatform {
  if (typeof navigator === "undefined") {
    return "unsupported";
  }

  const platform = navigator.platform.toLowerCase();
  const ua = navigator.userAgent.toLowerCase();

  if (platform.includes("win") || ua.includes("windows")) {
    return "windows";
  }
  if (platform.includes("mac") || ua.includes("mac os")) {
    return "macos";
  }
  if (platform.includes("linux") || ua.includes("linux")) {
    return "linux";
  }
  return "unsupported";
}

export function describeHostOperatorMismatch(
  hostPlatform: PiPlatform,
  operatorPlatform: PiPlatform,
): string | undefined {
  if (hostPlatform === operatorPlatform) {
    return undefined;
  }
  if (operatorPlatform === "windows" && hostPlatform === "linux") {
    return "Node host reports Linux — run Echo Mirage dev natively on Windows for windows-use.";
  }
  if (hostPlatform === "windows" && operatorPlatform !== "windows") {
    return "windows-use backend is on Windows, but operator UI is not.";
  }
  return `Host platform (${hostPlatform}) differs from operator (${operatorPlatform}).`;
}
