import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import type { OperatorBrowserLiveSnapshot } from "./operator-browser-live.types";

const FIRECRAWL_API_BASE = "https://api.firecrawl.dev/v2";
const FIRECRAWL_TIMEOUT_MS = 45_000;
const MAX_PAGE_TEXT_CHARS = 6000;
const DEFAULT_SEARCH_LIMIT = 5;

export function getFirecrawlApiKey(): string {
  return process.env.FIRECRAWL_API_KEY?.trim() ?? "";
}

export function isFirecrawlConfigured(): boolean {
  return getFirecrawlApiKey().length > 0;
}

function firecrawlHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${getFirecrawlApiKey()}`,
    "Content-Type": "application/json",
  };
}

function clampPageText(text: string): string {
  return text.trim().slice(0, MAX_PAGE_TEXT_CHARS);
}

function extractSearchQueryFromUrl(url: string): string | null {
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

type FirecrawlSearchHit = {
  url?: string;
  title?: string;
  markdown?: string;
  description?: string;
};

function collectSearchHits(payload: unknown): FirecrawlSearchHit[] {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as Record<string, unknown>;

  if (Array.isArray(root)) {
    return root as FirecrawlSearchHit[];
  }

  const data = root.data;
  if (Array.isArray(data)) {
    return data as FirecrawlSearchHit[];
  }
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const web = record.web;
    if (Array.isArray(web)) {
      return web as FirecrawlSearchHit[];
    }
    const results = record.results;
    if (Array.isArray(results)) {
      return results as FirecrawlSearchHit[];
    }
  }

  return [];
}

function formatSearchHitsAsPageText(hits: FirecrawlSearchHit[]): string {
  const parts: string[] = [];
  for (const [index, hit] of hits.entries()) {
    const title = hit.title?.trim() || `Result ${index + 1}`;
    const url = hit.url?.trim() || "";
    const body = hit.markdown?.trim() || hit.description?.trim() || "";
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

async function firecrawlPost(path: string, body: Record<string, unknown>): Promise<unknown> {
  const res = await fetchWithTimeout(
    `${FIRECRAWL_API_BASE}${path}`,
    {
      method: "POST",
      headers: firecrawlHeaders(),
      body: JSON.stringify(body),
    },
    FIRECRAWL_TIMEOUT_MS,
  );

  const text = await res.text().catch(() => "");
  let payload: unknown = null;
  try {
    payload = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof (payload as { error?: unknown }).error === "string"
        ? (payload as { error: string }).error
        : text.slice(0, 240) || `Firecrawl HTTP ${res.status}`;
    throw new Error(message);
  }

  return payload;
}

export async function firecrawlSearchWeb(
  query: string,
  limit = DEFAULT_SEARCH_LIMIT,
): Promise<OperatorBrowserLiveSnapshot> {
  const payload = await firecrawlPost("/search", {
    query,
    limit,
    scrapeOptions: { formats: ["markdown"] },
  });

  const hits = collectSearchHits(payload);
  const pageText = formatSearchHitsAsPageText(hits);
  if (!pageText.trim()) {
    throw new Error("Firecrawl search returned no readable results.");
  }

  const primary = hits[0];
  return {
    url: primary?.url?.trim() || `firecrawl-search:${query}`,
    title: `Firecrawl search: ${query}`,
    pageText,
    status: 200,
    engine: "firecrawl",
  };
}

export async function firecrawlScrapeUrl(url: string): Promise<OperatorBrowserLiveSnapshot> {
  const payload = await firecrawlPost("/scrape", {
    url,
    formats: ["markdown"],
    onlyMainContent: true,
  });

  if (!payload || typeof payload !== "object") {
    throw new Error("Firecrawl scrape returned an empty response.");
  }

  const root = payload as Record<string, unknown>;
  const data = (root.data && typeof root.data === "object" ? root.data : root) as Record<
    string,
    unknown
  >;
  const markdown = typeof data.markdown === "string" ? data.markdown : "";
  const metadata =
    data.metadata && typeof data.metadata === "object"
      ? (data.metadata as Record<string, unknown>)
      : {};
  const title =
    (typeof metadata.title === "string" && metadata.title.trim()) ||
    (typeof metadata.ogTitle === "string" && metadata.ogTitle.trim()) ||
    url;
  const sourceUrl =
    (typeof metadata.sourceURL === "string" && metadata.sourceURL.trim()) ||
    (typeof metadata.url === "string" && metadata.url.trim()) ||
    url;
  const pageText = clampPageText(markdown);

  if (!pageText.trim()) {
    throw new Error("Firecrawl scrape returned no markdown content.");
  }

  return {
    url: sourceUrl,
    title,
    pageText,
    status: 200,
    engine: "firecrawl",
  };
}

export async function firecrawlResearchGoto(url: string): Promise<OperatorBrowserLiveSnapshot> {
  const searchQuery = extractSearchQueryFromUrl(url);
  if (searchQuery) {
    return firecrawlSearchWeb(searchQuery);
  }
  return firecrawlScrapeUrl(url);
}
