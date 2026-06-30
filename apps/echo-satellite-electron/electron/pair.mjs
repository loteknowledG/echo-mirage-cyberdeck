import { ECHO_NODE_LABEL } from "./config.mjs";

/**
 * @param {string} rawUrl
 * @param {string} nodeId
 */
export function parseCapturePairUrl(rawUrl, nodeId) {
  const parsed = new URL(rawUrl.trim());
  const pairId = parsed.searchParams.get("pairId")?.trim();
  const pairSecret = parsed.searchParams.get("pairSecret")?.trim();
  const mirageHost = parsed.searchParams.get("mirageHost")?.trim();
  const mirageHttpPort = Number(parsed.searchParams.get("mirageHttpPort"));
  if (!pairId) throw new Error("Missing pairId in URL.");
  if (!pairSecret) throw new Error("Missing pairSecret in URL.");
  if (!mirageHost) throw new Error("Missing mirageHost in URL.");
  if (!Number.isFinite(mirageHttpPort) || mirageHttpPort <= 0) {
    throw new Error("Missing mirageHttpPort in URL.");
  }
  return { pairId, pairSecret, mirageHost, mirageHttpPort, nodeId };
}

/**
 * @param {{ pairId: string, pairSecret: string, mirageHost: string, mirageHttpPort: number, nodeId: string }} params
 */
export async function completeCapturePair(params) {
  const url = `http://${params.mirageHost}:${params.mirageHttpPort}/api/powerfist/pair/capture`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pairId: params.pairId,
      pairSecret: params.pairSecret,
      nodeId: params.nodeId,
      label: ECHO_NODE_LABEL,
    }),
  });

  const payload = await response.json();
  if (!payload?.ok) {
    return { ok: false, reason: payload?.reason ?? "Pair rejected." };
  }

  const captureToken = payload.captureToken?.trim?.() ?? "";
  const wsPort = Number(payload.wsPort);
  if (!captureToken || !Number.isFinite(wsPort) || wsPort <= 0) {
    return { ok: false, reason: "Pair response missing capture token or ws port." };
  }

  return {
    ok: true,
    credentials: {
      nodeId: payload.nodeId ?? params.nodeId,
      mirageHost: params.mirageHost,
      mirageHttpPort: params.mirageHttpPort,
      wsHost: payload.wsHost ?? params.mirageHost,
      wsPort,
      captureToken,
    },
  };
}
