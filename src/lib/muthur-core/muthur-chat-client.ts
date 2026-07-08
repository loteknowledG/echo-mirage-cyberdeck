/**
 * MUTHUR chat uplink client — framework-free helpers for talking to the
 * `/api/cyberdeck-chat` endpoint.
 *
 * Extracted from `cyberdeck-app.tsx` (L-CYBERDECK-001 P2.3). Contains no React.
 * Owns the uplink timeout budget, the request/stream plumbing for the main
 * MUTHUR uplink, the non-streaming review path, and the model probe fetch.
 */

/** Hard ceiling for a single MUTHUR uplink request before the client aborts. */
export const CHAT_UPLINK_TIMEOUT_MS = 300_000;

const CHAT_UPLINK_ENDPOINT = "/api/cyberdeck-chat";

/** JSON body posted to the uplink endpoint. Shape is validated server-side. */
export type CyberdeckChatUplinkBody = Record<string, unknown>;

/**
 * POST a JSON payload to the MUTHUR chat uplink. Returns the raw `Response` so
 * callers can inspect headers and read the streaming body themselves.
 */
export function postCyberdeckChatUplink(
  body: CyberdeckChatUplinkBody,
  signal?: AbortSignal,
): Promise<Response> {
  return fetch(CHAT_UPLINK_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    ...(signal ? { signal } : {}),
    body: JSON.stringify(body),
  });
}

/** Handle bundling an abort controller with its uplink timeout guard. */
export type UplinkTimeoutHandle = {
  controller: AbortController;
  /** Clear the pending timeout once the response has arrived. */
  clear: () => void;
  /** True when the request was aborted because it exceeded the timeout budget. */
  didTimeOut: () => boolean;
};

/**
 * Create an abort controller wired to the {@link CHAT_UPLINK_TIMEOUT_MS} budget.
 * The caller is responsible for calling `clear()` once the fetch resolves.
 */
export function createUplinkTimeout(): UplinkTimeoutHandle {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, CHAT_UPLINK_TIMEOUT_MS);
  return {
    controller,
    clear: () => clearTimeout(timeout),
    didTimeOut: () => timedOut,
  };
}

/**
 * Drain a chat uplink response body to a single string. Used by the
 * non-streaming review path. Returns `null` when the response has no body
 * reader (mirrors the original inline behaviour).
 */
export async function readCyberdeckChatStream(res: Response): Promise<string | null> {
  const reader = res.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  return text;
}

/** Parsed payload returned by the model probe endpoint. */
export type CyberdeckModelProbeData = {
  ok?: boolean;
  valid?: boolean;
  rateLimited?: boolean;
  status?: number;
};

/** Result of a model probe: transport status plus parsed payload. */
export type CyberdeckModelProbeResult = {
  ok: boolean;
  status: number;
  data: CyberdeckModelProbeData;
};

/**
 * Probe a provider/model pair for reachability. Mirrors the model-health
 * probe fetch that used to live inline in `cyberdeck-app.tsx`.
 */
export async function probeCyberdeckModel(
  params: { provider: string; apiKey: string; model: string },
  signal: AbortSignal,
): Promise<CyberdeckModelProbeResult> {
  const res = await postCyberdeckChatUplink(
    { probe: true, provider: params.provider, apiKey: params.apiKey, model: params.model },
    signal,
  );
  const data = (await res.json()) as CyberdeckModelProbeData;
  return { ok: res.ok, status: res.status, data };
}
