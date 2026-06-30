/** Espionage Spy pairing — 6-digit PIN shown on Echo, typed on Mirage / PowerFist. */

export const SPY_PAIR_PIN_LENGTH = 6;
export const DEFAULT_ECHO_HTTP_PORT = 3050;

export function normalizeSpyPairPin(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, SPY_PAIR_PIN_LENGTH);
}

export function isValidSpyPairPin(raw: string): boolean {
  return new RegExp(`^\\d{${SPY_PAIR_PIN_LENGTH}}$`).test(raw);
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
