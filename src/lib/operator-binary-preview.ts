/** Blob / custom-protocol URLs for operator PDF and image previews (L-13). */

/** Max bytes to load into renderer as base64/data URLs (avoids OOM on large PDFs). */
export const OPERATOR_MAX_INLINE_BINARY_BYTES = 8 * 1024 * 1024;

const BINARY_PREVIEW_EXTENSIONS = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".svg",
  ".bmp",
  ".ico",
  ".docx",
  ".doc",
  ".pptx",
  ".ppt",
  ".xlsx",
  ".xls",
] as const;

export function isOperatorBinaryPreviewPath(filePathOrName: string): boolean {
  const lower = filePathOrName.toLowerCase();
  const dot = lower.lastIndexOf(".");
  const ext = dot >= 0 ? lower.slice(dot) : "";
  return BINARY_PREVIEW_EXTENSIONS.some((candidate) => ext === candidate);
}

export function hasPdfFileSignature(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  );
}

export function isElectronOperatorBridge(): boolean {
  return typeof window !== "undefined" && Boolean(window.echoMirageOpen?.readOperatorFile);
}

/** Desktop-only URL scheme registered in electron/main.js. */
export function toEchoMirageFileUrl(absolutePath: string): string {
  const normalized = absolutePath.replace(/\\/g, "/");
  return `echo-mirage-file://${encodeURIComponent(normalized)}`;
}

export function createOperatorBlobUrl(file: Blob | File): string {
  return URL.createObjectURL(file);
}

export function revokeOperatorBlobUrl(url: string | null | undefined) {
  if (!url?.startsWith("blob:")) return;
  URL.revokeObjectURL(url);
}

export type OperatorIngestHints = {
  diskAbsolutePath?: string;
  /** Byte length when File is a placeholder (large on-disk binary). */
  fileSize?: number;
  /** Raw base64 from desktop read — only for files under OPERATOR_MAX_INLINE_BINARY_BYTES. */
  pdfBase64?: string;
};

export function resolveOperatorPdfPreviewUrl(file: File, hints?: OperatorIngestHints): string {
  const mime = file.type || "application/pdf";
  const byteSize = hints?.fileSize ?? file.size;

  if (
    hints?.pdfBase64 &&
    byteSize > 0 &&
    byteSize <= OPERATOR_MAX_INLINE_BINARY_BYTES
  ) {
    return `data:${mime};base64,${hints.pdfBase64}`;
  }

  if (hints?.diskAbsolutePath && isElectronOperatorBridge()) {
    return toEchoMirageFileUrl(hints.diskAbsolutePath);
  }

  if (file.size > 0 && file.size <= OPERATOR_MAX_INLINE_BINARY_BYTES) {
    return createOperatorBlobUrl(file);
  }

  if (hints?.diskAbsolutePath && isElectronOperatorBridge()) {
    return toEchoMirageFileUrl(hints.diskAbsolutePath);
  }

  return createOperatorBlobUrl(file);
}

export function resolveOperatorImagePreviewUrl(file: File, hints?: OperatorIngestHints): string {
  const byteSize = hints?.fileSize ?? file.size;

  if (hints?.diskAbsolutePath && isElectronOperatorBridge()) {
    return toEchoMirageFileUrl(hints.diskAbsolutePath);
  }

  if (file.size > 0 && byteSize <= OPERATOR_MAX_INLINE_BINARY_BYTES) {
    return createOperatorBlobUrl(file);
  }

  if (hints?.diskAbsolutePath && isElectronOperatorBridge()) {
    return toEchoMirageFileUrl(hints.diskAbsolutePath);
  }

  return createOperatorBlobUrl(file);
}
