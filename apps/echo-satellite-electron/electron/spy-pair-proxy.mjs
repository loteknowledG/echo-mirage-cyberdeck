const LOCAL_CYBERDECK_PORTS = [3000, 3001, 8080];

/**
 * @param {Record<string, unknown>} body
 */
export async function proxySpyPairEnter(body) {
  for (const port of LOCAL_CYBERDECK_PORTS) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/survey/pair/enter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(2500),
      });
      const payload = await res.json();
      if (payload?.ok) {
        return { ...payload, httpPort: payload.httpPort ?? port };
      }
      if (typeof payload?.reason === "string" && payload.reason.toLowerCase().includes("invalid pairing code")) {
        return payload;
      }
    } catch {
      /* try next port */
    }
  }

  return {
    ok: false,
    reason:
      "Echo Satellite could not reach the local cyberdeck. Open Survey → Echo on this Mac (http://127.0.0.1:3000) so PIN codes are active.",
  };
}
