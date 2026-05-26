export const DEFAULT_UPSTREAM_TIMEOUT_MS = 120_000;
export const MODEL_LIST_TIMEOUT_MS = 30_000;
export const MODEL_PROBE_TIMEOUT_MS = 120_000;
export const MEMORY_CONTEXT_TIMEOUT_MS = 2_500;

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_UPSTREAM_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
