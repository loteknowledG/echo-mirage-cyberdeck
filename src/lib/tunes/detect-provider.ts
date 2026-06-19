import type { TunesProvider } from "@/lib/tunes/types";

export type DetectedTunesTrackInput = {
  provider: TunesProvider;
  url: string;
  embedUrl?: string;
  providerId?: string;
  title: string;
};

const YOUTUBE_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

function extractYouTubeId(raw: string): string | null {
  const trimmed = raw.trim();
  if (YOUTUBE_ID_RE.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = url.pathname.slice(1).split("/")[0];
      return YOUTUBE_ID_RE.test(id) ? id : null;
    }

    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      if (url.pathname.startsWith("/embed/")) {
        const id = url.pathname.split("/")[2];
        return id && YOUTUBE_ID_RE.test(id) ? id : null;
      }
      if (url.pathname.startsWith("/shorts/")) {
        const id = url.pathname.split("/")[2];
        return id && YOUTUBE_ID_RE.test(id) ? id : null;
      }
      const v = url.searchParams.get("v");
      return v && YOUTUBE_ID_RE.test(v) ? v : null;
    }
  } catch {
    /* not a URL */
  }

  return null;
}

function extractIframeSrc(input: string): string | null {
  const match = input.match(/src=["']([^"']+)["']/i);
  return match?.[1]?.trim() ?? null;
}

function buildBandcampEmbedUrl(pageUrl: string): string | null {
  try {
    const url = new URL(pageUrl);
    const host = url.hostname.replace(/^www\./, "");
    if (!host.endsWith("bandcamp.com")) return null;

    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;

    const kind = parts[parts.length - 2];
    const slug = parts[parts.length - 1];
    if (kind !== "track" && kind !== "album") return null;

    const encoded = encodeURIComponent(`${url.origin}/${kind}/${slug}`);
    return `https://bandcamp.com/EmbeddedPlayer/${kind}=${encoded}/size=large/bgcol=000000/linkcol=39ff14/transparent=true/`;
  } catch {
    return null;
  }
}

function parseBandcampEmbed(input: string): DetectedTunesTrackInput | null {
  const src = extractIframeSrc(input) ?? input.trim();
  if (!src.includes("bandcamp.com")) return null;

  try {
    const url = new URL(src);
    if (!url.hostname.includes("bandcamp.com")) return null;
    const pageUrl = url.searchParams.get("url") ?? src;
    return {
      provider: "bandcamp",
      url: pageUrl.startsWith("http") ? pageUrl : src,
      embedUrl: src.includes("EmbeddedPlayer") ? src : buildBandcampEmbedUrl(pageUrl) ?? src,
      title: "Bandcamp track",
    };
  } catch {
    return null;
  }
}

function defaultTitle(provider: TunesProvider, url: string, providerId?: string): string {
  if (provider === "youtube" && providerId) return `YouTube ${providerId}`;
  if (provider === "bandcamp") {
    try {
      const path = new URL(url).pathname.split("/").filter(Boolean);
      const slug = path[path.length - 1];
      if (slug) return slug.replace(/-/g, " ");
    } catch {
      /* ignore */
    }
    return "Bandcamp track";
  }
  try {
    return new URL(url).hostname;
  } catch {
    return "External link";
  }
}

export function detectTunesTrackInput(rawInput: string): DetectedTunesTrackInput {
  const input = rawInput.trim();
  if (!input) {
    return {
      provider: "external",
      url: "",
      title: "Untitled",
    };
  }

  const youtubeId = extractYouTubeId(input);
  if (youtubeId) {
    const url = `https://www.youtube.com/watch?v=${youtubeId}`;
    return {
      provider: "youtube",
      url,
      embedUrl: `https://www.youtube.com/embed/${youtubeId}`,
      providerId: youtubeId,
      title: defaultTitle("youtube", url, youtubeId),
    };
  }

  const bandcamp = parseBandcampEmbed(input);
  if (bandcamp) return bandcamp;

  try {
    const url = new URL(input);
    const host = url.hostname.replace(/^www\./, "");
    if (host.endsWith("bandcamp.com")) {
      const embedUrl = buildBandcampEmbedUrl(input);
      return {
        provider: "bandcamp",
        url: input,
        embedUrl: embedUrl ?? undefined,
        title: defaultTitle("bandcamp", input),
      };
    }
  } catch {
    /* fall through */
  }

  return {
    provider: "external",
    url: input,
    title: defaultTitle("external", input),
  };
}

export function providerBadge(provider: TunesProvider): string {
  switch (provider) {
    case "youtube":
      return "YT";
    case "bandcamp":
      return "BC";
    case "external":
      return "EXT";
    default: {
      const _exhaustive: never = provider;
      return _exhaustive;
    }
  }
}
