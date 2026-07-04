import { isEchoMirageDesktopShell } from "@/lib/electron/desktop-install.client";

export const SURVEY_PWA_PAIR_BLOCKED_MESSAGE =
  "Installed PWA cannot reach Echo over Tailscale or LAN. On this laptop, click Open desktop cyberdeck below (or run pnpm electron:dev) and pair from there.";

export const LEGACY_SPY_PAIR_ENTER_PATH = "/api/spy/pair/enter";

export function isHttpsBrowserClient(): boolean {
  return typeof window !== "undefined" && window.location.protocol === "https:";
}

/** HTTPS PWA / hosted cyberdeck cannot call Echo Satellite on Tailscale or LAN. */
export function isSurveyHttpsPairBlocked(): boolean {
  return isHttpsBrowserClient() && !isEchoMirageDesktopShell();
}

export function isPwaPairReachabilityError(reason: string): boolean {
  const lower = reason.toLowerCase();
  return (
    lower.includes("could not reach") ||
    lower.includes("could not find echo") ||
    lower.includes("network") ||
    lower.includes("failed to fetch")
  );
}
