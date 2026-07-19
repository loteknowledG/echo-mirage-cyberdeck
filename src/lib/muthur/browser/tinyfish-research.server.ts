import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import type { OperatorBrowserLiveSnapshot } from "./operator-browser-live.types";
import {
  DEFAULT_SEARCH_LIMIT,
  WebResearchProviderError,
  clampPageText,
  extractSearchQueryFromUrl,
  formatSearchSnippetsAsPageText,
  type WebSearchSnippet,
} from "./web-research-shared.server";

const TINYFISH_SEARCH_API = "https://api.search.tinyfish.ai";
const TINYFISH_FETCH_API = "https://api.fetch.tinyfish.ai";
const TINYFISH_TIMEOUT_MS = 45_000;

export function getTinyfishApiKey(): string {
  return process.env.TINYFISH_API_KEY?.trim() ?? "";
}

export function isTinyfishConfigured(): boolean {
  return getTinyfishApiKey().length > 0;
}

function tinyfishHeaders(): Record<string, string> {
  return {
    "X-API-Key": getTinyfishApiKey(),
    "Content-Type": "application/json",
  };
}

type TinyfishSearchResult = {
  title?: string;
  url?: string;
  snippet?: string;
};

function collectTinyfishSearchHits(payload: unknown): TinyfishSearchResult[] {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as Record<string, unknown>;
  const results = root.results;
  return Array.isArray(results) ? (results as TinyfishSearchResult[]) : [];
}

async function tinyfishSearchWeb(query: string, limit = DEFAULT_SEARCH_LIMIT): Promise<OperatorBrowserLiveSnapshot> {
  const params = new URLSearchParams({
    query,
    language: "en",
    location: "US",
  });
  const res = await fetchWithTimeout(
    `${TINYFISH_SEARCH_API}?${params.toString()}`,
    {
      method: "GET",
      headers: tinyfishHeaders(),
    },
    TINYFISH_TIMEOUT_MS,
  );

  const text = await res.text().catch(() => "");
  let payload: unknown = null;
  try {
    payload = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const message = parseTinyfishErrorMessage(payload, text, res.status);
    throw new WebResearchProviderError(message, "tinyfish", res.status);
  }

  const hits = collectTinyfishSearchHits(payload).slice(0, limit);
  const snippets: WebSearchSnippet[] = hits.map((hit) => ({
    title: hit.title,
    url: hit.url,
    body: hit.snippet,
  }));
  const pageText = formatSearchSnippetsAsPageText(snippets);
  if (!pageText.trim()) {
    throw new Error("TinyFish search returned no readable results.");
  }

  const primary = hits[0];
  return {
    url: primary?.url?.trim() || `tinyfish-search:${query}`,
    title: `TinyFish search: ${query}`,
    pageText,
    status: 200,
    engine: "tinyfish",
  };
}

async function tinyfishFetchUrl(url: string): Promise<OperatorBrowserLiveSnapshot> {
  const res = await fetchWithTimeout(
    TINYFISH_FETCH_API,
    {
      method: "POST",
      headers: tinyfishHeaders(),
      body: JSON.stringify({
        urls: [url],
        format: "markdown",
        ttl: 0,
      }),
    },
    TINYFISH_TIMEOUT_MS,
  );

  const text = await res.text().catch(() => "");
  let payload: unknown = null;
  try {
    payload = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const message = parseTinyfishErrorMessage(payload, text, res.status);
    throw new WebResearchProviderError(message, "tinyfish", res.status);
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("TinyFish fetch returned an empty response.");
  }

  const root = payload as Record<string, unknown>;
  const results = Array.isArray(root.results) ? root.results : [];
  const first = results[0] as Record<string, unknown> | undefined;
  const markdown = typeof first?.text === "string" ? first.text : "";
  const title = typeof first?.title === "string" ? first.title.trim() : url;
  const sourceUrl =
    (typeof first?.final_url === "string" && first.final_url.trim()) ||
    (typeof first?.url === "string" && first.url.trim()) ||
    url;
  const pageText = clampPageText(markdown);

  if (!pageText.trim()) {
    const errors = Array.isArray(root.errors) ? root.errors : [];
    const err = errors[0] as { error?: string } | undefined;
    throw new Error(err?.error || "TinyFish fetch returned no markdown content.");
  }

  return {
    url: sourceUrl,
    title,
    pageText,
    status: 200,
    engine: "tinyfish",
  };
}

function parseTinyfishErrorMessage(payload: unknown, raw: string, status: number): string {
  if (payload && typeof payload === "object") {
    const error = (payload as { error?: { message?: string } }).error;
    if (error && typeof error.message === "string" && error.message.trim()) {
      return error.message.trim();
    }
  }
  return raw.slice(0, 240) || `TinyFish HTTP ${status}`;
}

export async function tinyfishResearchGoto(url: string): Promise<OperatorBrowserLiveSnapshot> {
  const searchQuery = extractSearchQueryFromUrl(url);
  if (searchQuery) {
    return tinyfishSearchWeb(searchQuery);
  }
  return tinyfishFetchUrl(url);
}
