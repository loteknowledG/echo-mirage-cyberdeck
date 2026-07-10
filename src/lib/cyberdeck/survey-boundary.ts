/**
 * Survey ↔ Cyberdeck boundary
 *
 * KEEP (stable integration with MUTHUR / operator / PowerFist):
 * - survey-chat.ts — mission lines, SURVEY_MUTHUR_ARCHIVE_EVENT, SURVEY_MISSION_SOLVE_EVENT
 * - survey-capture-deck / powerfist-capture-client — screenshot missions → MUTHUR handleSend
 * - survey-extension-page-context — Survey Satellite browser extension → page text (no clipboard)
 * - Operator network tests (Phase 0/1): docs/survey-network-tests.md
 * - terminateEchoSurveySession — only when Survey tab closes on Echo-local cyberdeck
 *
 * LEGACY (frozen — do not extend; Survey Hub replaces this):
 * - survey-pairing-client, relay, team socket, spy API fallbacks, Tailscale direct pair
 *
 * Import pairing/relay modules only from Survey pane components — never from cyberdeck-app core.
 *
 * ─── Three transports (decision tree) ───────────────────────────────────────────
 *
 * Survey triple-link needs three independent links:
 *   Echo ↔ Mirage · Echo ↔ PowerFist · Mirage ↔ PowerFist (hub)
 *
 * There are three transport families. Pick ONE path per link — do not add a fourth
 * without updating this tree and survey-hub.client.ts orchestration.
 *
 * ```
 * isSurveyHubEnabled()?
 * ├─ YES → SurveyAutoPairHost / requestSurveyHubConnect() only (no new auto-connect sites)
 * │        runSurveyHubConnect() in survey-hub.client.ts
 * │        ├─ Desktop shell + can reach Echo LAN/localhost?
 * │        │   (NOT isSurveyHttpsPairBlocked)
 * │        │   → TRANSPORT A: direct HTTP pair
 * │        │      fetchEchoSurveyStatus → enterSurveyPairPin → Echo /api/survey/pair/enter
 * │        │      Same machine: team ID optional; Echo pins read locally.
 * │        └─ Hosted HTTPS PWA or LAN direct failed?
 * │            → TRANSPORT B: cloud relay
 * │               fetchSurveyRelayBundle(teamId) → enterSurveyPairPinViaRelay
 * │               Echo Satellite pushes bundle to /api/survey/relay/* (Upstash/file store)
 * │               Requires saved echoNodeId (team ID) on first connect.
 * │        └─ Third link (Mirage ↔ PowerFist) always:
 * │            → TRANSPORT C: Mirage hub / PowerFist remote socket
 * │               fetchPowerfistQrSession · completePowerfistPairFromPin · WS to Mirage
 * │               Modules: survey-hub-socket.ts, survey-mirage-hub-panel (legacy UI)
 * │
 * └─ NO → SurveyLegacyNotice — enable Survey Hub (``localStorage.survey-hub="1"``)
 *        Mirage hub manual pair remains on PowerFist tab for transport C only.
 * ```
 *
 * Module map:
 * | Transport | When | Primary modules | Never import from |
 * |-----------|------|-----------------|-------------------|
 * | A Direct LAN/localhost HTTP | Desktop cyberdeck, Echo reachable | survey-pair-enter.client, survey-echo-status.client | cyberdeck-app core |
 * | B Cloud relay | isSurveyHttpsPairBlocked() or Hub LAN fallback | survey-relay.client, survey-cloud-relay.server | cyberdeck-app core |
 * | C Mirage hub WS | powerfist-hub step after Echo links | survey-hub-socket.ts | cyberdeck-app core |
 * | D Team socket (aux) | Deprecated legacy pairing hints | survey-team-socket.client.ts | cyberdeck-app core |
 *
 * Rules before adding features:
 * 1. New connect orchestration → SurveyAutoPairHost + events (survey-hub-connect-events.ts).
 * 2. New pairing UI → gate with isSurveyHubEnabled(); Hub on = status + Retry only.
 * 3. Do not wire team socket into Hub auto-connect — it is a legacy hint channel.
 * 4. Echo Satellite /api/spy/* compat stays in Echo apps; cyberdeck uses /api/survey/*.
 * 5. Backend flip (Next relay/hub vs Go sidecars): docs/survey-emp-backends.md
 * ────────────────────────────────────────────────────────────────────────────────
 */

import { isSurveyHttpsPairBlocked } from "@/lib/cyberdeck/survey-pairing-shared.client";

/** Survey transport ids — for logging/probes; Hub orchestrates A+B+C. */
export type SurveyTransportId = "direct-http" | "cloud-relay" | "mirage-hub-ws" | "team-socket-aux";

export const SURVEY_TRANSPORT_LABELS: Record<SurveyTransportId, string> = {
  "direct-http": "Direct HTTP pair (Echo LAN/localhost)",
  "cloud-relay": "Cloud relay (HTTPS / cross-network)",
  "mirage-hub-ws": "Mirage hub WebSocket (PowerFist ↔ Mirage)",
  "team-socket-aux": "Team socket (deprecated legacy pairing hints)",
};

/**
 * Which transport Hub connect should prefer for Echo↔Mirage and Echo↔PowerFist links.
 * Mirage hub (C) is always handled separately in runSurveyHubConnect powerfist-hub step.
 */
export function resolvePreferredSurveyPairTransport(): Exclude<
  SurveyTransportId,
  "mirage-hub-ws" | "team-socket-aux"
> {
  if (typeof window === "undefined") {
    return "cloud-relay";
  }
  return isSurveyHttpsPairBlocked() ? "cloud-relay" : "direct-http";
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
