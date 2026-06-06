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
  const pathPart = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return `echo-mirage-file://${encodeURI(pathPart)}`;
}

export function decodeEchoMirageFileUrl(url: string): string | null {
  const prefix = "echo-mirage-file://";
  if (!url.startsWith(prefix)) return null;
  let filePath = decodeURIComponent(url.slice(prefix.length));
  if (filePath.startsWith("/") && /^\/[a-zA-Z]:\//.test(filePath)) {
    filePath = filePath.slice(1);
  }
  return filePath;
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
  /** Raw base64 for any inline binary (e.g. DOCX) when File is not populated yet. */
  inlineBase64?: string;
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

export function resolveOperatorDocxPreviewUrl(file: File, hints?: OperatorIngestHints): string {
  const mime =
    file.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const byteSize = hints?.fileSize ?? file.size;

  if (
    hints?.inlineBase64 &&
    byteSize > 0 &&
    byteSize <= OPERATOR_MAX_INLINE_BINARY_BYTES
  ) {
    return `data:${mime};base64,${hints.inlineBase64}`;
  }

  if (file.size > 0 && byteSize <= OPERATOR_MAX_INLINE_BINARY_BYTES) {
    return createOperatorBlobUrl(file);
  }

  if (hints?.diskAbsolutePath && isElectronOperatorBridge()) {
    return toEchoMirageFileUrl(hints.diskAbsolutePath);
  }

  return createOperatorBlobUrl(file);
}

export async function fetchOperatorDocxBlob(docxSrc: string): Promise<Blob> {
  if (docxSrc.startsWith("data:")) {
    const response = await fetch(docxSrc);
    if (!response.ok) throw new Error(`Could not load DOCX (${response.status})`);
    return response.blob();
  }

  if (docxSrc.startsWith("blob:")) {
    const response = await fetch(docxSrc);
    if (!response.ok) throw new Error(`Could not load DOCX (${response.status})`);
    return response.blob();
  }

  if (docxSrc.startsWith("echo-mirage-file://")) {
    const diskPath = decodeEchoMirageFileUrl(docxSrc);
    const fixedSrc = diskPath ? toEchoMirageFileUrl(diskPath) : docxSrc;
    try {
      const response = await fetch(fixedSrc);
      if (response.ok) return response.blob();
    } catch {
      /* fall through to legacy URL attempt */
    }
    try {
      const response = await fetch(docxSrc);
      if (response.ok) return response.blob();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load DOCX from disk.";
      throw new Error(message);
    }
  }

  const response = await fetch(docxSrc);
  if (!response.ok) {
    throw new Error(`Could not load DOCX (${response.status})`);
  }
  return response.blob();
}

export function resolveOperatorImagePreviewUrl(file: File, hints?: OperatorIngestHints): string {
  const mime = operatorImageMimeType(file);
  const byteSize = hints?.fileSize ?? file.size;

  if (
    hints?.inlineBase64 &&
    byteSize > 0 &&
    byteSize <= OPERATOR_MAX_INLINE_BINARY_BYTES
  ) {
    return `data:${mime};base64,${hints.inlineBase64}`;
  }

  if (file.size > 0 && byteSize <= OPERATOR_MAX_INLINE_BINARY_BYTES) {
    return createOperatorBlobUrl(file);
  }

  if (hints?.diskAbsolutePath && isElectronOperatorBridge()) {
    return toEchoMirageFileUrl(hints.diskAbsolutePath);
  }

  return createOperatorBlobUrl(file);
}

function operatorImageMimeType(file: File): string {
  if (file.type?.startsWith("image/")) return file.type;
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".bmp")) return "image/bmp";
  if (lower.endsWith(".ico")) return "image/x-icon";
  return "application/octet-stream";
}

export async function fetchOperatorBinaryBlob(src: string): Promise<Blob> {
  if (src.startsWith("data:") || src.startsWith("blob:")) {
    const response = await fetch(src);
    if (!response.ok) throw new Error(`Could not load file (${response.status})`);
    return response.blob();
  }

  if (src.startsWith("echo-mirage-file://")) {
    const diskPath = decodeEchoMirageFileUrl(src);
    const fixedSrc = diskPath ? toEchoMirageFileUrl(diskPath) : src;
    try {
      const response = await fetch(fixedSrc);
      if (response.ok) return response.blob();
    } catch {
      /* try legacy URL */
    }
    const response = await fetch(src);
    if (!response.ok) throw new Error(`Could not load file from disk (${response.status})`);
    return response.blob();
  }

  const response = await fetch(src);
  if (!response.ok) throw new Error(`Could not load file (${response.status})`);
  return response.blob();
}
