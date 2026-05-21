/** Supported import formats for MarkItDown conversion (L-5). */
export const CONVERTIBLE_DOCUMENT_EXTENSIONS = [".pdf", ".docx"] as const;

export type ConvertDocumentIntent = {
  filePath: string;
};

/**
 * Parse operator commands such as:
 * `muthur md resume.pdf`
 * `muthur convert resume.pdf to markdown`
 * `/muthur md C:\path\file.docx`
 */
export function parseConvertDocumentIntent(text: string): ConvertDocumentIntent | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const patterns = [
    /^\/muthur\s+md\s+(.+)$/i,
    /^muthur\s+md\s+(.+)$/i,
    /^\/muthur\s+convert\s+(.+?)\s+to\s+markdown\s*$/i,
    /^muthur\s+convert\s+(.+?)\s+to\s+markdown\s*$/i,
    /^convert_document_to_markdown\s+(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) {
      const filePath = match[1].trim().replace(/^["']|["']$/g, "");
      if (filePath) return { filePath };
    }
  }

  return null;
}

export function isConvertibleDocumentPath(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return CONVERTIBLE_DOCUMENT_EXTENSIONS.some((ext) => lower.endsWith(ext));
}
