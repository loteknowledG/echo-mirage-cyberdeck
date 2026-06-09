/**
 * Operator pane routing: text vs PDF vs image vs unsupported binary/office (L-13).
 */

import type { OperatorIngestFileKind } from "@/lib/operator-file-ingest";
import {
  hasPdfFileSignature,
  resolveOperatorDocxPreviewUrl,
  resolveOperatorImagePreviewUrl,
  resolveOperatorPdfPreviewUrl,
  type OperatorIngestHints,
} from "@/lib/operator-binary-preview";

export type { OperatorIngestHints } from "@/lib/operator-binary-preview";
import type { OperatorDocumentPickerKind } from "@/lib/operator-document-types";
import { normalizeOperatorDocumentKind } from "@/lib/operator-document-types";

export type OperatorAssetSurface =
  | "markdown"
  | "text"
  | "image"
  | "pdf"
  | "docx"
  | "office-unsupported"
  | "video"
  | "binary-unsafe";

const DOCX_EXTENSIONS = [".docx"] as const;
const OFFICE_UNSUPPORTED_EXTENSIONS = [".doc", ".pptx", ".ppt", ".xlsx", ".xls"] as const;

const TEXT_EDITABLE_EXTENSIONS = [
  ".txt",
  ".json",
  ".jsonc",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".css",
  ".scss",
  ".html",
  ".htm",
  ".xml",
  ".yaml",
  ".yml",
  ".toml",
  ".ini",
  ".env",
  ".sh",
  ".bash",
  ".zsh",
  ".py",
  ".rb",
  ".go",
  ".rs",
  ".java",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
  ".cs",
  ".php",
  ".sql",
  ".csv",
  ".tsv",
  ".log",
  ".md",
  ".markdown",
] as const;

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".bmp", ".ico"] as const;

export type OperatorIngestedAsset = {
  surface: OperatorAssetSurface;
  kind: OperatorIngestFileKind;
  name: string;
  mimeType: string;
  size: number;
  text?: string;
  imageSrc?: string;
  pdfSrc?: string;
  docxSrc?: string;
};

function fileExtension(name: string): string {
  const lower = name.toLowerCase();
  const dot = lower.lastIndexOf(".");
  return dot >= 0 ? lower.slice(dot) : "";
}

function matchesExtension(name: string, extensions: readonly string[]): boolean {
  const ext = fileExtension(name);
  return extensions.some((candidate) => ext === candidate);
}

function detectSurfaceFromNameAndMime(file: File): OperatorAssetSurface | null {
  const lowerName = file.name.toLowerCase();
  const mime = (file.type || "").toLowerCase();

  if (lowerName.endsWith(".pdf") || mime === "application/pdf") return "pdf";
  if (
    matchesExtension(lowerName, DOCX_EXTENSIONS) ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }
  if (mime.startsWith("image/") || matchesExtension(lowerName, IMAGE_EXTENSIONS)) return "image";
  if (mime.startsWith("video/")) return "video";
  if (matchesExtension(lowerName, OFFICE_UNSUPPORTED_EXTENSIONS)) return "office-unsupported";
  if (
    lowerName.endsWith(".md") ||
    lowerName.endsWith(".markdown") ||
    mime === "text/markdown"
  ) {
    return "markdown";
  }
  if (matchesExtension(lowerName, TEXT_EDITABLE_EXTENSIONS)) return "text";
  if (
    mime.startsWith("text/") ||
    mime === "application/json" ||
    mime === "application/xml" ||
    mime === "application/javascript" ||
    mime === "application/typescript" ||
    mime === "application/x-yaml"
  ) {
    return "text";
  }
  return null;
}

function hasPdfSignature(bytes: Uint8Array): boolean {
  return hasPdfFileSignature(bytes);
}

function hasPngSignature(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  );
}

function hasJpegSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function hasGifSignature(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
  );
}

function hasWebpSignature(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
}

function detectSurfaceFromBytes(bytes: Uint8Array): OperatorAssetSurface | null {
  if (hasPdfSignature(bytes)) return "pdf";
  if (hasPngSignature(bytes) || hasJpegSignature(bytes) || hasGifSignature(bytes) || hasWebpSignature(bytes)) {
    return "image";
  }
  return null;
}

/** Sniff first bytes when extension/MIME are ambiguous. */
export async function sniffOperatorFileSurface(file: File): Promise<OperatorAssetSurface | null> {
  try {
    const buffer = await file.slice(0, Math.min(file.size, 512)).arrayBuffer();
    return detectSurfaceFromBytes(new Uint8Array(buffer));
  } catch {
    return null;
  }
}

export type BinaryTextAnalysis = {
  safe: boolean;
  reason?: "null-bytes" | "pdf-signature" | "non-printable-density";
};

/** Block markdown/text viewer when content looks binary (L-13). */
export function analyzeTextForBinaryDisplay(
  text: string,
  hints?: { fileName?: string },
): BinaryTextAnalysis {
  if (!text) return { safe: true };

  const sample = text.slice(0, 16_384);
  if (sample.includes("\0")) return { safe: false, reason: "null-bytes" };
  if (sample.startsWith("%PDF")) return { safe: false, reason: "pdf-signature" };

  let nonPrintable = 0;
  for (let i = 0; i < sample.length; i += 1) {
    const code = sample.charCodeAt(i);
    if (code === 9 || code === 10 || code === 13) continue;
    if (code < 32 || (code > 126 && code < 160)) nonPrintable += 1;
  }
  if (sample.length >= 32 && nonPrintable / sample.length > 0.28) {
    return { safe: false, reason: "non-printable-density" };
  }

  const ext = hints?.fileName ? fileExtension(hints.fileName) : "";
  if (ext === ".pdf") return { safe: false, reason: "pdf-signature" };

  return { safe: true };
}

export function resolveOperatorAssetSurface(asset: {
  surface?: OperatorAssetSurface;
  kind?: string;
  name?: string;
  pdfSrc?: string;
  docxSrc?: string;
  imageSrc?: string;
  text?: string;
}): OperatorAssetSurface {
  if (asset.surface) return asset.surface;
  if (asset.text) {
    const analysis = analyzeTextForBinaryDisplay(asset.text, { fileName: asset.name });
    if (!analysis.safe) {
      if (
        analysis.reason === "pdf-signature" ||
        asset.name?.toLowerCase().endsWith(".pdf") ||
        asset.kind === "pdf"
      ) {
        return "pdf";
      }
      return "binary-unsafe";
    }
  }
  if (asset.pdfSrc || asset.kind === "pdf") return "pdf";
  if (
    asset.docxSrc ||
    asset.kind === "docx" ||
    asset.name?.toLowerCase().endsWith(".docx")
  ) {
    return "docx";
  }
  if (asset.imageSrc || asset.kind === "image") return "image";
  if (asset.kind === "video") return "video";
  if (asset.kind === "file" && !asset.text) return "binary-unsafe";
  const normalized = normalizeOperatorDocumentKind(asset.kind);
  if (normalized === "markdown") return "markdown";
  if (isOperatorTextEditableKind(normalized)) return "text";
  return "binary-unsafe";
}

export function isOperatorTextEditableKind(kind: string | undefined): boolean {
  const normalized = normalizeOperatorDocumentKind(kind);
  return (
    normalized === "markdown" ||
    normalized === "text" ||
    normalized === "json" ||
    normalized === "css" ||
    normalized === "html" ||
    normalized === "javascript" ||
    normalized === "typescript" ||
    normalized === "python"
  );
}

export function isOperatorTextEditableSurface(surface: OperatorAssetSurface): boolean {
  return surface === "markdown" || surface === "text";
}

/** True when a workspace path is a Monaco-editable text/markdown file. */
export function isOperatorWorkspaceTextPath(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return matchesExtension(lower, TEXT_EDITABLE_EXTENSIONS);
}

export function pickerKindForSurface(surface: OperatorAssetSurface): OperatorDocumentPickerKind {
  if (surface === "markdown") return "markdown";
  if (surface === "text") return "text";
  if (surface === "pdf") return "pdf";
  if (surface === "docx") return "docx";
  return "text";
}

export async function buildOperatorIngestFromFile(
  file: File,
  hints?: OperatorIngestHints,
): Promise<OperatorIngestedAsset> {
  let surface =
    detectSurfaceFromNameAndMime(file) ?? (await sniffOperatorFileSurface(file)) ?? "binary-unsafe";

  const base = {
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    size: hints?.fileSize ?? file.size,
  };

  if (surface === "image") {
    try {
      const imageSrc = resolveOperatorImagePreviewUrl(file, hints);
      return { surface, kind: "image", ...base, imageSrc };
    } catch {
      return { surface, kind: "image", ...base };
    }
  }

  if (surface === "pdf") {
    try {
      if (file.size > 0) {
        const header = new Uint8Array(await file.slice(0, 4).arrayBuffer());
        if (!hasPdfSignature(header) && !hints?.diskAbsolutePath) {
          return { surface: "binary-unsafe", kind: "file", ...base };
        }
      }
      const pdfSrc = resolveOperatorPdfPreviewUrl(file, hints);
      return { surface, kind: "pdf", ...base, pdfSrc };
    } catch {
      if (hints?.diskAbsolutePath) {
        try {
          const pdfSrc = resolveOperatorPdfPreviewUrl(file, hints);
          return { surface, kind: "pdf", ...base, pdfSrc };
        } catch {
          return { surface, kind: "pdf", ...base };
        }
      }
      return { surface, kind: "pdf", ...base };
    }
  }

  if (surface === "video") {
    return { surface, kind: "video", ...base };
  }

  if (surface === "docx") {
    try {
      const docxSrc = resolveOperatorDocxPreviewUrl(file, hints);
      return { surface, kind: "docx", ...base, docxSrc };
    } catch {
      return { surface, kind: "docx", ...base };
    }
  }

  if (surface === "office-unsupported") {
    return { surface, kind: "file", ...base };
  }

  if (surface === "markdown" || surface === "text") {
    try {
      const text = await file.text();
      const analysis = analyzeTextForBinaryDisplay(text, { fileName: file.name });
      if (!analysis.safe) {
        const sniffed = await sniffOperatorFileSurface(file);
        if (sniffed === "pdf") {
          try {
            const pdfSrc = resolveOperatorPdfPreviewUrl(file, hints);
            return { surface: "pdf", kind: "pdf", ...base, pdfSrc };
          } catch {
            return { surface: "binary-unsafe", kind: "file", ...base };
          }
        }
        if (sniffed === "image") {
          try {
            const imageSrc = resolveOperatorImagePreviewUrl(file, hints);
            return { surface: "image", kind: "image", ...base, imageSrc };
          } catch {
            return { surface: "binary-unsafe", kind: "file", ...base };
          }
        }
        return { surface: "binary-unsafe", kind: "file", ...base };
      }
      const kind = surface === "markdown" ? "markdown" : "text";
      return { surface, kind, ...base, text };
    } catch {
      return { surface: "binary-unsafe", kind: "file", ...base };
    }
  }

  return { surface: "binary-unsafe", kind: "file", ...base };
}
