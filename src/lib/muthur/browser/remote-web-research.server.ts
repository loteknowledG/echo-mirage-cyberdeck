import { firecrawlResearchGoto, isFirecrawlConfigured } from "./firecrawl-research.server";
import type { OperatorBrowserLiveSnapshot } from "./operator-browser-live.types";
import { isTinyfishConfigured, tinyfishResearchGoto } from "./tinyfish-research.server";
import { shouldFallbackWebResearchProvider } from "./web-research-shared.server";

export async function remoteWebResearchGoto(url: string): Promise<OperatorBrowserLiveSnapshot> {
  let firecrawlError: unknown = null;

  if (isFirecrawlConfigured()) {
    try {
      return await firecrawlResearchGoto(url);
    } catch (error) {
      firecrawlError = error;
      if (!shouldFallbackWebResearchProvider(error) || !isTinyfishConfigured()) {
        throw error;
      }
    }
  }

  if (isTinyfishConfigured()) {
    try {
      return await tinyfishResearchGoto(url);
    } catch (error) {
      if (firecrawlError) {
        const primary =
          firecrawlError instanceof Error ? firecrawlError.message : "Firecrawl fetch failed.";
        const secondary = error instanceof Error ? error.message : "TinyFish fetch failed.";
        throw new Error(`Firecrawl failed (${primary}); TinyFish fallback failed (${secondary}).`);
      }
      throw error;
    }
  }

  if (firecrawlError) {
    throw firecrawlError;
  }

  throw new Error(
    "No remote web research provider configured. Set FIRECRAWL_API_KEY and/or TINYFISH_API_KEY for live web research on Vercel.",
  );
}
