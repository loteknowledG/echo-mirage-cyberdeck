import {
  docxFilenameFromMarkdownName,
  pdfFilenameFromMarkdownName,
} from "@/lib/markdown-to-docx-intent";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF_MIME = "application/pdf";

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** @deprecated Use downloadBlob */
export const downloadDocxBlob = downloadBlob;

async function exportMarkdownToFormat(options: {
  markdown: string;
  suggestedFilename?: string;
  outputPath?: string;
  apiPath: "/api/convert-markdown-to-docx" | "/api/convert-markdown-to-pdf";
  defaultFilename: string;
  formatLabel: string;
}): Promise<{ filename: string; outputPath?: string }> {
  const res = await fetch(options.apiPath, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      markdown: options.markdown,
      suggestedFilename: options.suggestedFilename,
      outputPath: options.outputPath,
    }),
  });

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const payload = (await res.json()) as {
      ok?: boolean;
      error?: string;
      outputPath?: string;
      suggestedFilename?: string;
    };
    if (!res.ok || !payload.ok) {
      throw new Error(payload.error || `${options.formatLabel} export failed (${res.status})`);
    }
    return {
      filename: payload.suggestedFilename || options.defaultFilename,
      outputPath: payload.outputPath,
    };
  }

  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || `${options.formatLabel} export failed (${res.status})`);
  }

  const disposition = res.headers.get("content-disposition") || "";
  const match = /filename="([^"]+)"/i.exec(disposition);
  const filename = match?.[1] || options.defaultFilename;
  const blob = await res.blob();
  downloadBlob(blob, filename);
  return { filename };
}

export async function exportMarkdownToDocx(options: {
  markdown: string;
  suggestedFilename?: string;
  outputPath?: string;
}): Promise<{ filename: string; outputPath?: string }> {
  return exportMarkdownToFormat({
    ...options,
    apiPath: "/api/convert-markdown-to-docx",
    defaultFilename: docxFilenameFromMarkdownName(options.suggestedFilename || "document.md"),
    formatLabel: "DOCX",
  });
}

export async function exportMarkdownToPdf(options: {
  markdown: string;
  suggestedFilename?: string;
  outputPath?: string;
}): Promise<{ filename: string; outputPath?: string }> {
  return exportMarkdownToFormat({
    ...options,
    apiPath: "/api/convert-markdown-to-pdf",
    defaultFilename: pdfFilenameFromMarkdownName(options.suggestedFilename || "document.md"),
    formatLabel: "PDF",
  });
}

export { DOCX_MIME, PDF_MIME };
