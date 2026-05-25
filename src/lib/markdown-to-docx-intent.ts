export function docxFilenameFromMarkdownName(name: string): string {
  const trimmed = name.trim() || "document";
  if (/\.docx$/i.test(trimmed)) return trimmed;
  if (/\.(md|markdown)$/i.test(trimmed)) {
    return trimmed.replace(/\.(md|markdown)$/i, ".docx");
  }
  const base = trimmed.includes(".") ? trimmed.replace(/\.[^.]+$/, "") : trimmed;
  return `${base || "document"}.docx`;
}

export function pdfFilenameFromMarkdownName(name: string): string {
  const trimmed = name.trim() || "document";
  if (/\.pdf$/i.test(trimmed)) return trimmed;
  if (/\.(md|markdown)$/i.test(trimmed)) {
    return trimmed.replace(/\.(md|markdown)$/i, ".pdf");
  }
  const base = trimmed.includes(".") ? trimmed.replace(/\.[^.]+$/, "") : trimmed;
  return `${base || "document"}.pdf`;
}

export type OperatorExportFormat = "docx" | "pdf";

/** Parse operator/MUTHUR commands to export markdown files to DOCX. */
export type ExportMarkdownToDocxIntent = {
  filePath?: string;
  fromOperator?: boolean;
};

export type ExportMarkdownToPdfIntent = {
  filePath?: string;
  fromOperator?: boolean;
};

export function parseExportMarkdownToDocxIntent(text: string): ExportMarkdownToDocxIntent | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const operatorPatterns = [
    /^\/muthur\s+export(?:\s+to)?\s+docx\s*$/i,
    /^muthur\s+export(?:\s+to)?\s+docx\s*$/i,
    /^export(?:\s+to)?\s+docx\s*$/i,
    /^\/export(?:\s+to)?\s+docx\s*$/i,
  ];
  if (operatorPatterns.some((pattern) => pattern.test(trimmed))) {
    return { fromOperator: true };
  }

  const filePatterns = [
    /^\/muthur\s+docx\s+(.+)$/i,
    /^muthur\s+docx\s+(.+)$/i,
    /^\/muthur\s+export\s+(.+?)\s+to\s+docx\s*$/i,
    /^muthur\s+export\s+(.+?)\s+to\s+docx\s*$/i,
    /^export_markdown_to_docx\s+(.+)$/i,
  ];

  for (const pattern of filePatterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) {
      const filePath = match[1].trim().replace(/^["']|["']$/g, "");
      if (filePath) return { filePath };
    }
  }

  return null;
}

export function parseExportMarkdownToPdfIntent(text: string): ExportMarkdownToPdfIntent | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const operatorPatterns = [
    /^\/muthur\s+export(?:\s+to)?\s+pdf\s*$/i,
    /^muthur\s+export(?:\s+to)?\s+pdf\s*$/i,
    /^export(?:\s+to)?\s+pdf\s*$/i,
    /^\/export(?:\s+to)?\s+pdf\s*$/i,
  ];
  if (operatorPatterns.some((pattern) => pattern.test(trimmed))) {
    return { fromOperator: true };
  }

  const filePatterns = [
    /^\/muthur\s+pdf\s+(.+)$/i,
    /^muthur\s+pdf\s+(.+)$/i,
    /^\/muthur\s+export\s+(.+?)\s+to\s+pdf\s*$/i,
    /^muthur\s+export\s+(.+?)\s+to\s+pdf\s*$/i,
    /^export_markdown_to_pdf\s+(.+)$/i,
  ];

  for (const pattern of filePatterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) {
      const filePath = match[1].trim().replace(/^["']|["']$/g, "");
      if (filePath) return { filePath };
    }
  }

  return null;
}

export function isExportableMarkdownPath(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return lower.endsWith(".md") || lower.endsWith(".markdown");
}
