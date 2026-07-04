/**
 * Survey ↔ Cyberdeck boundary
 *
 * KEEP (stable integration with MUTHUR / operator / PowerFist):
 * - survey-chat.ts — mission lines, SURVEY_MUTHUR_ARCHIVE_EVENT, SURVEY_MISSION_SOLVE_EVENT
 * - survey-capture-deck / powerfist-capture-client — screenshot missions → MUTHUR handleSend
 * - terminateEchoSurveySession — only when Survey tab closes on Echo-local cyberdeck
 *
 * LEGACY (frozen — do not extend; Survey Hub replaces this):
 * - survey-pairing-client, relay, team socket, spy API fallbacks, Tailscale direct pair
 *
 * Import pairing/relay modules only from Survey pane components — never from cyberdeck-app core.
 */

import { resolveSurveyCyberdeckShell } from "@/lib/electron/desktop-install.client";

/** Legacy LAN/Tailscale/relay pairing UI. Default: desktop + localhost only. */
export function isSurveyLegacyPairingEnabled(): boolean {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_SURVEY_LEGACY_PAIRING === "1";
  }
  try {
    const override = window.localStorage.getItem("survey-legacy-pairing");
    if (override === "1") return true;
    if (override === "0") return false;
  } catch {
    /* ignore */
  }
  if (process.env.NEXT_PUBLIC_SURVEY_LEGACY_PAIRING === "1") return true;
  if (process.env.NEXT_PUBLIC_SURVEY_LEGACY_PAIRING === "0") return false;
  return resolveSurveyCyberdeckShell().canDirectPairEcho;
}

/** When true, [SURVEY DBG] lines are mirrored into MUTHUR chat. Default off. */
export function isSurveyPairingDebugEnabled(): boolean {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_SURVEY_PAIRING_DEBUG === "1";
  }
  try {
    if (window.localStorage.getItem("survey-pairing-debug") === "1") return true;
  } catch {
    /* ignore */
  }
  return process.env.NEXT_PUBLIC_SURVEY_PAIRING_DEBUG === "1";
}

export const SURVEY_HUB_NOTICE =
  "Survey Hub wires Echo ↔ Mirage ↔ PowerFist automatically. Open Echo Satellite Survey tab, enter your team ID once, then Connect team.";

/** Survey Hub — cloud + desktop auto-connect. Default on. */
export function isSurveyHubEnabled(): boolean {
  if (typeof window === "undefined") {
    if (process.env.NEXT_PUBLIC_SURVEY_HUB === "0") return false;
    return true;
  }
  try {
    const override = window.localStorage.getItem("survey-hub");
    if (override === "1") return true;
    if (override === "0") return false;
  } catch {
    /* ignore */
  }
  if (process.env.NEXT_PUBLIC_SURVEY_HUB === "0") return false;
  return true;
}

/** @deprecated use isSurveyHubEnabled — Survey Hub replaced desktop auto-pair flag */
export function isSurveyAutoPairEnabled(): boolean {
  return isSurveyHubEnabled();
}
