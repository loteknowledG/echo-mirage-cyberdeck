export const MAX_PAGE_TEXT_CHARS = 6000;
export const DEFAULT_SEARCH_LIMIT = 5;

export function clampPageText(text: string): string {
  return text.trim().slice(0, MAX_PAGE_TEXT_CHARS);
}

export function extractSearchQueryFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host.includes("duckduckgo.com") || host.includes("google.com") || host.includes("bing.com")) {
      const q = parsed.searchParams.get("q")?.trim();
      if (q) return q;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export type WebSearchSnippet = {
  url?: string;
  title?: string;
  body?: string;
};

export function formatSearchSnippetsAsPageText(hits: WebSearchSnippet[]): string {
  const parts: string[] = [];
  for (const [index, hit] of hits.entries()) {
    const title = hit.title?.trim() || `Result ${index + 1}`;
    const url = hit.url?.trim() || "";
    const body = hit.body?.trim() || "";
    parts.push(
      [
        `=== ${title} ===`,
        url ? `URL: ${url}` : null,
        body || "(no excerpt)",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  return clampPageText(parts.join("\n\n"));
}

export class WebResearchProviderError extends Error {
  readonly status: number;
  readonly provider: string;

  constructor(message: string, provider: string, status: number) {
    super(message);
    this.name = "WebResearchProviderError";
    this.provider = provider;
    this.status = status;
  }
}

export function shouldFallbackWebResearchProvider(error: unknown): boolean {
  if (error instanceof WebResearchProviderError) {
    if (error.status === 402 || error.status === 429 || error.status === 403) {
      return true;
    }
  }
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return /credit|quota|payment|rate limit|insufficient|paywall|billing/.test(message);
}
