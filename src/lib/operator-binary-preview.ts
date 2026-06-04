/** Blob / custom-protocol URLs for operator PDF and image previews (L-13). */

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
  /** Raw base64 from Echo Mirage desktop read-operator-file (avoids broken custom-protocol embeds). */
  pdfBase64?: string;
};

export function resolveOperatorPdfPreviewUrl(file: File, hints?: OperatorIngestHints): string {
  const mime = file.type || "application/pdf";
  if (hints?.pdfBase64) {
    return `data:${mime};base64,${hints.pdfBase64}`;
  }
  if (file.size > 0) {
    return createOperatorBlobUrl(file);
  }
  if (hints?.diskAbsolutePath && isElectronOperatorBridge()) {
    return toEchoMirageFileUrl(hints.diskAbsolutePath);
  }
  return createOperatorBlobUrl(file);
}

export function resolveOperatorImagePreviewUrl(file: File, hints?: OperatorIngestHints): string {
  if (file.size > 0) {
    return createOperatorBlobUrl(file);
  }
  if (hints?.diskAbsolutePath && isElectronOperatorBridge()) {
    return toEchoMirageFileUrl(hints.diskAbsolutePath);
  }
  return createOperatorBlobUrl(file);
}
