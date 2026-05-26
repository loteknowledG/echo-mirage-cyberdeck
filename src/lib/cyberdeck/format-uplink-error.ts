/**
 * Turn raw HTTP error bodies into short operator-facing text (never dump HTML pages).
 */
export function formatUplinkErrorDetail(status: number, raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    if (status === 401 || status === 403) return "Invalid or missing API key.";
    if (status === 429) return "Rate limited by provider.";
    if (status === 500) return "Uplink internal error — check dev terminal and retry.";
    if (status === 502 || status === 503) return "Provider unavailable.";
    return `HTTP ${status}`;
  }

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const payload = JSON.parse(trimmed) as {
        error?: string | { message?: string; type?: string };
        message?: string;
      };
      if (typeof payload.error === "string" && payload.error.trim()) {
        return payload.error.trim();
      }
      if (payload.error && typeof payload.error === "object") {
        const nested = payload.error.message?.trim();
        if (nested) return nested;
        const type = payload.error.type?.trim();
        if (type) return type;
      }
      if (typeof payload.message === "string" && payload.message.trim()) {
        return payload.message.trim();
      }
    } catch {
      /* fall through */
    }
  }

  if (
    trimmed.startsWith("<!DOCTYPE") ||
    trimmed.startsWith("<html") ||
    trimmed.includes("__next_error__") ||
    trimmed.includes("Internal Server Error")
  ) {
    return status === 500
      ? "Cyberdeck uplink crashed (internal error). Check the dev terminal and retry."
      : "Provider returned an HTML error page instead of a model response.";
  }

  if (trimmed.length > 240) {
    return `${trimmed.slice(0, 240)}…`;
  }

  return trimmed;
}
