import {
  buildCadreFilename,
  parseCadreTitleParts,
  resolveCadreSaveTarget,
  slugifyCadreDescription,
} from "@/lib/cadre-constitutional-routing";

export { resolveCadreSaveTarget } from "@/lib/cadre-constitutional-routing";

/** First markdown H1 (`# title`, not `##`). */
export function parseMarkdownH1Title(markdown: string): string | null {
  for (const line of markdown.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = /^#(?!#)\s+(.+)$/.exec(trimmed);
    if (match) return match[1].trim();
  }
  return null;
}

/** L-3 cadre filename from H1, or null if no H1 / unknown prefix. */
export function deriveMarkdownSaveFilename(markdown: string): string | null {
  const h1 = parseMarkdownH1Title(markdown);
  if (!h1) return null;
  const parts = parseCadreTitleParts(h1);
  if (!parts) return null;
  return buildCadreFilename(parts.prefix, parts.description);
}

export function deriveOperatorSaveFilename(options: {
  kind: string | undefined;
  text: string;
  fallbackName?: string;
}): string {
  const { kind, text, fallbackName } = options;
  const trimmedFallback = fallbackName?.trim();

  if (kind === "markdown") {
    const routing = resolveCadreSaveTarget(text, { kind: "markdown" });
    if (routing.constitutionalPrefix) {
      return routing.filename;
    }
    return trimmedFallback || routing.filename;
  }

  if (trimmedFallback) return trimmedFallback;
  if (kind === "code") return "operator-doc.txt";
  return "operator-doc.txt";
}

/** @deprecated Use slugifyCadreDescription via cadre-constitutional-routing */
export function sanitizeDocumentFilename(title: string, extension = ".md"): string {
  const ext = extension.startsWith(".") ? extension : `.${extension}`;
  const parts = parseCadreTitleParts(title);
  const base = parts
    ? `${parts.prefix}-${slugifyCadreDescription(parts.description)}`
    : slugifyCadreDescription(title) || "untitled";
  return base.toLowerCase().endsWith(ext.toLowerCase()) ? base : `${base}${ext}`;
}
