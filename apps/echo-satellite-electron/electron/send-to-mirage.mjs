import { DEFAULT_PAIR_HTTP_PORT } from "./config.mjs";
import { preferredEchoHost } from "./spy-echo-pairing.mjs";

const MIRAGE_CYBERDECK_URL =
  process.env.ECHO_MIRAGE_CYBERDECK_URL?.trim() || "https://echo-mirage-cyberdeck.vercel.app/cyberdeck";

/**
 * @param {{ echoHost: string, httpPort?: number, miragePin: string | null, lanHosts?: string[] }} status
 */
export function buildMiragePairingBundle(status) {
  const pin = status.miragePin?.trim();
  if (!pin) {
    return { ok: false, reason: "No Mirage code — tap New codes first." };
  }

  const host = preferredEchoHost(status.lanHosts?.length ? status.lanHosts : [status.echoHost]);
  const port = status.httpPort || DEFAULT_PAIR_HTTP_PORT;
  const mirageUrl = new URL(MIRAGE_CYBERDECK_URL);
  mirageUrl.searchParams.set("echoHost", host);
  mirageUrl.searchParams.set("echoPort", String(port));
  if (status.echoNodeId) {
    mirageUrl.searchParams.set("echoNodeId", status.echoNodeId);
  }
  mirageUrl.searchParams.set("survey", "mirage");

  const clipboardText = [
    "Echo Mirage — pair Mirage with Echo Satellite",
    "",
    `Echo IP: ${host}`,
    `Port: ${port}`,
    `Mirage code: ${pin}`,
    "",
    "On the solver laptop:",
    "1. Open cyberdeck (PWA or desktop) → Survey → Mirage (m)",
    "2. Enter Echo team ID + Mirage code → Pair with ECHO",
    "   (Team ID is in Echo Satellite status — cloud relay, no IP needed)",
    "",
    `Echo team ID: ${status.echoNodeId ?? "(open satellite status)"}`,
    "",
    `Pairing link: ${mirageUrl.toString()}`,
  ].join("\n");

  return {
    ok: true,
    host,
    port,
    pin,
    mirageUrl: mirageUrl.toString(),
    clipboardText,
    message: "Copied for Mirage — paste on the solver laptop (Messages, Slack, etc.).",
  };
}
