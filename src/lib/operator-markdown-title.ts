import {
  buildCadreFilename,
  parseCadreTitleParts,
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

/** True when the document's first non-empty line is a markdown H1. */
export function isMarkdownH1Document(text: string): boolean {
  return parseMarkdownH1Title(text) !== null;
}

export type OperatorDocumentKind = "markdown" | "text" | "code";

export function inferOperatorDocumentFromText(
  text: string,
  hints?: {
    fileName?: string;
    fileKind?: OperatorDocumentKind | "file" | "image" | "video";
    mimeType?: string;
  },
): {
  kind: OperatorDocumentKind;
  mimeType: string;
  suggestedFilename: string | null;
} {
  const extMarkdown = Boolean(hints?.fileName && /\.(md|markdown)$/i.test(hints.fileName));
  const mimeMarkdown = hints?.mimeType === "text/markdown";
  const h1Markdown = isMarkdownH1Document(text);

  if (extMarkdown || mimeMarkdown || h1Markdown) {
    return {
      kind: "markdown",
      mimeType: "text/markdown",
      suggestedFilename: deriveMarkdownSaveFilename(text),
    };
  }

  if (hints?.fileKind === "code") {
    return {
      kind: "code",
      mimeType: hints.mimeType || "text/plain",
      suggestedFilename: null,
    };
  }

  return {
    kind: "text",
    mimeType: "text/plain",
    suggestedFilename: null,
  };
}

/** Filename from first H1 (cadre prefix or slugified title); null when no H1. */
export function deriveMarkdownSaveFilename(markdown: string): string | null {
  const h1 = parseMarkdownH1Title(markdown);
  if (!h1) return null;
  const parts = parseCadreTitleParts(h1);
  if (parts) return buildCadreFilename(parts.prefix, parts.description);
  const slug = slugifyCadreDescription(h1);
  return slug ? `${slug}.md` : null;
}

export function deriveOperatorSaveFilename(options: {
  kind: string | undefined;
  text: string;
  fallbackName?: string;
}): string {
  const { kind, text, fallbackName } = options;
  const trimmedFallback = fallbackName?.trim();

  if (kind === "markdown") {
    const fromH1 = deriveMarkdownSaveFilename(text);
    if (fromH1) return fromH1;
    return trimmedFallback || "operator-doc.md";
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
