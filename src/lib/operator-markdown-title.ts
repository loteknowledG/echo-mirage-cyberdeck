import {
  deriveMarkdownSaveFilename,
  deriveOperatorSaveFilename,
  inferOperatorPickerKindFromAsset,
  operatorMimeTypeForKind,
  type OperatorDocumentKind,
  type OperatorDocumentPickerKind,
} from "@/lib/operator-document-types";

export {
  applyOperatorTextAutodetect,
  deriveMarkdownSaveFilename,
  deriveOperatorSaveFilename,
  normalizeOperatorDocumentKind,
  operatorDocTypeIndex,
  operatorMimeTypeForKind,
  OPERATOR_DOC_TYPE_ENTRIES,
  resolveOperatorDocumentNameForKind,
  type OperatorDocumentKind,
  type OperatorDocumentPickerKind,
} from "@/lib/operator-document-types";

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

export function inferOperatorDocumentFromText(
  text: string,
  hints?: {
    fileName?: string;
    fileKind?: OperatorDocumentKind | "file" | "image" | "video" | "code";
    mimeType?: string;
  },
): {
  kind: OperatorDocumentPickerKind;
  mimeType: string;
  suggestedFilename: string | null;
} {
  const kind = inferOperatorPickerKindFromAsset(text, hints);
  return {
    kind,
    mimeType: operatorMimeTypeForKind(kind),
    suggestedFilename: kind === "markdown" ? deriveMarkdownSaveFilename(text) : null,
  };
}
