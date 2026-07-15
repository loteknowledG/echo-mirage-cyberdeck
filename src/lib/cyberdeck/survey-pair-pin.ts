/** Survey pairing — 6-digit PIN shown on Echo, typed on Mirage / PowerFist. */

export const SURVEY_PAIR_PIN_LENGTH = 6;
export const DEFAULT_ECHO_HTTP_PORT = 3050;
/** Default Tailscale mesh IP for Echo Mac when pairing from Windows Mirage. */
export const DEFAULT_ECHO_TAILSCALE_HOST = "100.70.46.6";

/** Classic RFC1918 LAN (not Tailscale CGNAT 100.64/10). */
export function isLanPrivateEchoHost(host: string): boolean {
  const h = host.trim().toLowerCase();
  if (!h) return false;
  if (h.startsWith("192.168.") || h.startsWith("10.")) return true;
  return /^172\.(1[6-9]|2\d|3[0-1])\./.test(h);
}

/** Tailscale CGNAT 100.64.0.0/10. */
export function isTailscaleCgNatHost(host: string): boolean {
  const m = /^100\.(\d+)\./.exec(host.trim());
  if (!m) return false;
  const second = Number(m[1]);
  return second >= 64 && second <= 127;
}

/**
 * Satellite often advertises a LAN IP Windows Mirage cannot use for capture.
 * Prefer Tailscale mesh when the host looks like classic LAN.
 */
export function preferMeshEchoHost(
  host: string | null | undefined,
  meshFallback: string = DEFAULT_ECHO_TAILSCALE_HOST,
): string | null {
  const trimmed = host?.trim() || null;
  if (!trimmed) return null;
  if (isLanPrivateEchoHost(trimmed) && !isTailscaleCgNatHost(trimmed)) {
    return meshFallback;
  }
  return trimmed;
}

export function normalizeSurveyPairPin(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, SURVEY_PAIR_PIN_LENGTH);
}

export function isValidSurveyPairPin(raw: string): boolean {
  return new RegExp(`^\\d{${SURVEY_PAIR_PIN_LENGTH}}$`).test(raw);
}

/** Accept `192.168.1.5`, `192.168.1.5:3050`, or `http://192.168.1.5:3050` — not double-ported. */
export function parseEchoEndpointInput(
  hostInput: string,
  fallbackPort = DEFAULT_ECHO_HTTP_PORT,
): { host: string; port: number } {
  const raw = hostInput.trim();
  if (!raw) {
    return { host: "", port: fallbackPort };
  }

  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      const port = Number(url.port || fallbackPort) || fallbackPort;
      return { host: url.hostname, port };
    } catch {
      return { host: raw, port: fallbackPort };
    }
  }

  const lastColon = raw.lastIndexOf(":");
  if (lastColon > 0 && raw.indexOf(":") === lastColon) {
    const hostPart = raw.slice(0, lastColon).trim();
    const portPart = Number(raw.slice(lastColon + 1));
    if (hostPart && Number.isFinite(portPart) && portPart > 0 && portPart <= 65535) {
      return { host: hostPart, port: portPart };
    }
  }

  return { host: raw, port: fallbackPort };
}

/** Split host:port / URL input into separate fields for the pairing form. */
export function formatEchoEndpointFields(
  hostInput: string,
  portInput: string,
  fallbackPort = DEFAULT_ECHO_HTTP_PORT,
): { host: string; port: string } {
  const parsed = parseEchoEndpointInput(hostInput, Number(portInput) || fallbackPort);
  return { host: parsed.host, port: String(parsed.port) };
}
