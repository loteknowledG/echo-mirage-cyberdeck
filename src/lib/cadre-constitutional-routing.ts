import { parseMarkdownH1Title } from "@/lib/operator-markdown-title";

export type CadreSaveTarget = {
  relativeDirectory: string;
  filename: string;
  /** Relative path from repo root for save dialog / download hint */
  suggestedRelativePath: string;
  constitutionalPrefix: string | null;
};

const CADRE_ROOT = "docs/cadre/";

const JUDGE_PREFIXES = ["ER-", "JR-", "JP-", "JF-"] as const;

/** Split H1 into constitutional prefix and descriptive title. */
export function parseCadreTitleParts(
  title: string,
): { prefix: string; description: string } | null {
  const match =
    /^(ER-\d+(?:\.\d+)?|JR-\d+(?:\.\d+)?|JP-\d+(?:\.\d+)?|JF-\d+(?:\.\d+)?|E-\d+|L-\d+)\s*[—\-]\s*(.+)$/i.exec(
      title.trim(),
    );
  if (!match) return null;
  return {
    prefix: normalizeConstitutionalPrefix(match[1]),
    description: match[2].trim(),
  };
}

export function normalizeConstitutionalPrefix(raw: string): string {
  const match = /^(ER|JR|JP|JF|E|L)-(\d+(?:\.\d+)?)$/i.exec(raw.trim());
  if (!match) return raw.trim();
  return `${match[1].toUpperCase()}-${match[2]}`;
}

export function slugifyCadreDescription(description: string): string {
  return description
    .replace(/\u2014/g, "-")
    .replace(/—/g, "-")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase()
    .replace(/^-+|-+$/g, "");
}

export function resolveCadreFolder(prefix: string): string {
  const head = prefix.toUpperCase();
  if (JUDGE_PREFIXES.some((p) => head.startsWith(p))) {
    return `${CADRE_ROOT}judge-tester/`;
  }
  if (head.startsWith("E-")) {
    return `${CADRE_ROOT}executive-coder/`;
  }
  if (head.startsWith("L-")) {
    return `${CADRE_ROOT}tech-lead-legislator/`;
  }
  return CADRE_ROOT;
}

export function buildCadreFilename(prefix: string, description: string): string {
  const slug = slugifyCadreDescription(description);
  return `${prefix}-${slug}.md`;
}

const FALLBACK_TARGET: CadreSaveTarget = {
  relativeDirectory: CADRE_ROOT,
  filename: "operator-doc.md",
  suggestedRelativePath: `${CADRE_ROOT}operator-doc.md`,
  constitutionalPrefix: null,
};

/** Resolve Cadre folder + filename from markdown H1 (L-3). */
export function resolveCadreSaveTarget(
  markdown: string,
  options?: { kind?: string },
): CadreSaveTarget {
  if (options?.kind && options.kind !== "markdown") {
    return FALLBACK_TARGET;
  }

  const h1 = parseMarkdownH1Title(markdown);
  if (!h1) return FALLBACK_TARGET;

  const parts = parseCadreTitleParts(h1);
  if (!parts) return FALLBACK_TARGET;

  const relativeDirectory = resolveCadreFolder(parts.prefix);
  const filename = buildCadreFilename(parts.prefix, parts.description);
  const suggestedRelativePath = `${relativeDirectory}${filename}`.replace(/\/{2,}/g, "/");

  return {
    relativeDirectory,
    filename,
    suggestedRelativePath,
    constitutionalPrefix: parts.prefix,
  };
}
