export const ONELINE_ART_MANIFEST_URL = "/glyph/oneline-art.json";
export const ASKY_ONELINE_ART_MANIFEST_URL = "/glyph/asky-oneline-art.json";
export const KULAONE_ONELINE_ART_MANIFEST_URL = "/glyph/kulaone-oneline-art.json";

/** Last line (1-based) from ww9 gist raw file to include. */
export const ONELINE_ART_MAX_RAW_LINE = 482;

export type OnelineArtManifest = {
  source?: string;
  maxRawLine?: number;
  count?: number;
  lines: string[];
};

export type AskyOnelineEntry = {
  id: number;
  title: string;
  content: string;
};

export type AskyOnelineArtManifest = {
  source?: string;
  bundle?: string;
  count?: number;
  entries: AskyOnelineEntry[];
};

export type KulaoneOnelineEntry = {
  nid: string;
  title: string;
  art: string;
  category: string;
};

export type KulaoneOnelineArtManifest = {
  source?: string;
  data?: string;
  count?: number;
  entries: KulaoneOnelineEntry[];
};

export type OnelineArtCatalogEntry = {
  id: string;
  title: string;
  content: string;
  source: "ww9" | "asky" | "kulaone";
};

function isIntroLine(line: string): boolean {
  return /^collection of emojis/i.test(line) || /^# collection of one line/i.test(line);
}

/** Skip emoji catalog rows (©️ … Sign) and standalone emoji glyphs. */
export function isExcludedOnelineArt(line: string): boolean {
  if (/\uFE0F/.test(line)) return true;
  if (isIntroLine(line)) return true;

  const withoutDescription = line.replace(/\s+[a-zA-Z][a-zA-Z\s.'’-]*$/, "").trim();
  const core = withoutDescription.replace(/\s/g, "");
  if (core && /^\p{Extended_Pictographic}+$/u.test(core)) return true;

  if (/[\\_|()[\]{}<>^~=\-*#\/]/.test(line)) return false;

  const compact = line.replace(/\s+/g, "");
  if (compact.length <= 2 && /\p{Extended_Pictographic}/u.test(compact)) return true;

  return false;
}

export function parseOnelineArtText(
  text: string,
  maxRawLine: number = ONELINE_ART_MAX_RAW_LINE,
): string[] {
  const rawLines = text.split(/\r?\n/);
  const limit = Math.min(rawLines.length, maxRawLine);
  const lines: string[] = [];

  for (let i = 0; i < limit; i++) {
    const line = rawLines[i]?.trim() ?? "";
    if (!line || line.startsWith("#")) continue;
    if (isExcludedOnelineArt(line)) continue;
    lines.push(line);
  }

  return lines;
}

/** Short label for the rotary slot (full art still goes to composer). */
export function onelineArtPickerLabel(art: string, maxLen = 22): string {
  const compact = art.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLen) return compact;
  return `${compact.slice(0, Math.max(0, maxLen - 1))}…`;
}

function sortCatalog(entries: OnelineArtCatalogEntry[]): OnelineArtCatalogEntry[] {
  return [...entries].sort((a, b) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
  );
}

export async function fetchOnelineArtCatalog(): Promise<OnelineArtCatalogEntry[]> {
  const [ww9Res, askyRes, kulaoneRes] = await Promise.all([
    fetch(ONELINE_ART_MANIFEST_URL),
    fetch(ASKY_ONELINE_ART_MANIFEST_URL),
    fetch(KULAONE_ONELINE_ART_MANIFEST_URL),
  ]);

  const catalog: OnelineArtCatalogEntry[] = [];
  const seenContent = new Set<string>();

  const pushEntry = (entry: OnelineArtCatalogEntry) => {
    if (seenContent.has(entry.content)) return;
    seenContent.add(entry.content);
    catalog.push(entry);
  };

  if (ww9Res.ok) {
    const ww9 = (await ww9Res.json()) as OnelineArtManifest;
    if (Array.isArray(ww9.lines)) {
      ww9.lines.forEach((content, index) => {
        pushEntry({
          id: `ww9:${index}`,
          title: onelineArtPickerLabel(content, 24),
          content,
          source: "ww9",
        });
      });
    }
  }

  if (askyRes.ok) {
    const asky = (await askyRes.json()) as AskyOnelineArtManifest;
    if (Array.isArray(asky.entries)) {
      for (const entry of asky.entries) {
        const content = entry.content.trim();
        if (!content) continue;
        pushEntry({
          id: `asky:${entry.id}`,
          title: entry.title.trim() || onelineArtPickerLabel(content, 24),
          content,
          source: "asky",
        });
      }
    }
  }

  if (kulaoneRes.ok) {
    const kulaone = (await kulaoneRes.json()) as KulaoneOnelineArtManifest;
    if (Array.isArray(kulaone.entries)) {
      for (const entry of kulaone.entries) {
        const content = entry.art.trim();
        if (!content) continue;
        pushEntry({
          id: `kulaone:${entry.nid}`,
          title: entry.title.trim() || onelineArtPickerLabel(content, 24),
          content,
          source: "kulaone",
        });
      }
    }
  }

  if (catalog.length === 0) {
    throw new Error("No one-line art entries loaded");
  }

  return sortCatalog(catalog);
}

/** @deprecated Use fetchOnelineArtCatalog */
export async function fetchOnelineArtLines(): Promise<string[]> {
  const catalog = await fetchOnelineArtCatalog();
  return catalog.map((entry) => entry.content);
}
