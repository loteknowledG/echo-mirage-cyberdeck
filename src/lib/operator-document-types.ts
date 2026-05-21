import type { IconType } from "react-icons";
import { AiOutlineFilePdf, AiOutlinePython } from "react-icons/ai";
import { BsMarkdown } from "react-icons/bs";
import { GrCss3 } from "react-icons/gr";
import { RiJavascriptLine } from "react-icons/ri";
import { TbBrandHtml5, TbBrandTypescript, TbFileTypeTxt } from "react-icons/tb";
import { isMarkdownH1Document, parseMarkdownH1Title } from "@/lib/operator-markdown-title";
import {
  buildCadreFilename,
  parseCadreTitleParts,
  slugifyCadreDescription,
} from "@/lib/cadre-constitutional-routing";

export type OperatorDocumentPickerKind =
  | "css"
  | "html"
  | "javascript"
  | "markdown"
  | "pdf"
  | "python"
  | "text"
  | "typescript";

export type OperatorDocumentKind = OperatorDocumentPickerKind;

/** @deprecated Legacy assets may still use `code`; maps to javascript in the picker. */
export function normalizeOperatorDocumentKind(
  kind: string | undefined,
): OperatorDocumentPickerKind {
  if (kind === "code") return "javascript";
  if (
    kind === "css" ||
    kind === "html" ||
    kind === "javascript" ||
    kind === "markdown" ||
    kind === "pdf" ||
    kind === "python" ||
    kind === "text" ||
    kind === "typescript"
  ) {
    return kind;
  }
  return "text";
}

export const OPERATOR_DOC_TYPE_ENTRIES: Array<{
  value: OperatorDocumentPickerKind;
  label: string;
  Icon: IconType;
  mimeType: string;
}> = [
  { value: "css", label: "CSS", Icon: GrCss3, mimeType: "text/css" },
  { value: "html", label: "HTML", Icon: TbBrandHtml5, mimeType: "text/html" },
  { value: "javascript", label: "JavaScript", Icon: RiJavascriptLine, mimeType: "text/javascript" },
  { value: "markdown", label: "Markdown", Icon: BsMarkdown, mimeType: "text/markdown" },
  { value: "pdf", label: "PDF", Icon: AiOutlineFilePdf, mimeType: "application/pdf" },
  { value: "python", label: "Python", Icon: AiOutlinePython, mimeType: "text/x-python" },
  { value: "text", label: "Text", Icon: TbFileTypeTxt, mimeType: "text/plain" },
  { value: "typescript", label: "TypeScript", Icon: TbBrandTypescript, mimeType: "text/typescript" },
];

export function operatorDocTypeIndex(kind: OperatorDocumentPickerKind): number {
  const normalized = normalizeOperatorDocumentKind(kind);
  const idx = OPERATOR_DOC_TYPE_ENTRIES.findIndex((entry) => entry.value === normalized);
  return idx >= 0 ? idx : 0;
}

export function operatorMimeTypeForKind(kind: OperatorDocumentPickerKind): string {
  const normalized = normalizeOperatorDocumentKind(kind);
  return (
    OPERATOR_DOC_TYPE_ENTRIES.find((entry) => entry.value === normalized)?.mimeType ?? "text/plain"
  );
}

export function inferOperatorPickerKindFromAsset(
  text: string,
  hints?: { fileName?: string; fileKind?: string; mimeType?: string },
): OperatorDocumentPickerKind {
  const fileName = hints?.fileName?.toLowerCase() ?? "";
  const ext = fileName.includes(".") ? fileName.split(".").pop() : "";

  if (ext === "md" || ext === "markdown" || hints?.mimeType === "text/markdown") {
    return "markdown";
  }
  if (isMarkdownH1Document(text)) return "markdown";
  if (ext === "html" || ext === "htm") return "html";
  if (ext === "css") return "css";
  if (ext === "js" || ext === "mjs" || ext === "cjs") return "javascript";
  if (ext === "ts" || ext === "tsx") return "typescript";
  if (ext === "py") return "python";
  if (ext === "pdf") return "pdf";
  if (hints?.fileKind === "code") return "javascript";
  if (hints?.fileKind && hints.fileKind !== "file" && hints.fileKind !== "image" && hints.fileKind !== "video") {
    return normalizeOperatorDocumentKind(hints.fileKind);
  }
  return "text";
}

export function deriveMarkdownSaveFilename(markdown: string): string | null {
  const h1 = parseMarkdownH1Title(markdown);
  if (!h1) return null;
  const parts = parseCadreTitleParts(h1);
  if (parts) return buildCadreFilename(parts.prefix, parts.description);
  const slug = slugifyCadreDescription(h1);
  return slug ? `${slug}.md` : null;
}

export function resolveOperatorDocumentNameForKind(
  kind: OperatorDocumentPickerKind,
  text: string,
  currentName: string,
): string {
  if (kind !== "markdown") return currentName;
  return deriveMarkdownSaveFilename(text) ?? currentName;
}

export function applyOperatorTextAutodetect<T extends {
  kind: string;
  name: string;
  mimeType: string;
  size: number;
  text?: string;
}>(asset: T): T {
  if (!asset.text) return asset;
  const kind = inferOperatorPickerKindFromAsset(asset.text, {
    fileName: asset.name,
    fileKind: asset.kind,
    mimeType: asset.mimeType,
  });
  return {
    ...asset,
    kind,
    mimeType: operatorMimeTypeForKind(kind),
    name:
      kind === "markdown"
        ? deriveMarkdownSaveFilename(asset.text) ?? asset.name
        : asset.name,
    size: new Blob([asset.text]).size,
  };
}

export function isOperatorDocumentSurfaceKind(kind: string | undefined): boolean {
  const normalized = normalizeOperatorDocumentKind(kind);
  return OPERATOR_DOC_TYPE_ENTRIES.some((entry) => entry.value === normalized);
}

const GENERIC_MARKDOWN_SAVE_NAMES = new Set(["operator-doc.md", "document.md", "converted.md"]);

/** True when a name is safe to use as the operator markdown save default. */
export function isValidMarkdownSaveFilename(name: string | undefined): boolean {
  const trimmed = name?.trim();
  if (!trimmed || !/\.md$/i.test(trimmed)) return false;
  if (/[<>:"/\\|?*\u0000-\u001f]/.test(trimmed)) return false;
  return true;
}

/** Loaded filename worth preferring over header/H1 (excludes autodetect placeholders). */
export function isMeaningfulMarkdownSaveFilename(name: string | undefined): boolean {
  if (!isValidMarkdownSaveFilename(name)) return false;
  return !GENERIC_MARKDOWN_SAVE_NAMES.has(name!.trim().toLowerCase());
}

/**
 * Save-dialog default filename for operator documents.
 * Priority (markdown): current loaded name → header draft → H1-derived → operator-doc.md
 */
export function deriveOperatorSaveFilename(options: {
  kind: string | undefined;
  text: string;
  /** Loaded asset filename (priority 1). */
  currentName?: string;
  /** Operator header filename field, including uncommitted edits (priority 2). */
  headerName?: string;
  /** @deprecated Use currentName */
  fallbackName?: string;
}): string {
  const { kind, text, currentName, headerName, fallbackName } = options;
  const normalized = normalizeOperatorDocumentKind(kind);
  const loadedName = currentName?.trim() || fallbackName?.trim();

  if (normalized === "markdown") {
    if (isMeaningfulMarkdownSaveFilename(loadedName)) return loadedName!;
    if (isValidMarkdownSaveFilename(headerName)) return headerName!.trim();
    const fromH1 = deriveMarkdownSaveFilename(text);
    if (fromH1) return fromH1;
    return "operator-doc.md";
  }

  if (loadedName) return loadedName;
  const header = headerName?.trim();
  if (header) return header;
  return "operator-doc.txt";
}
