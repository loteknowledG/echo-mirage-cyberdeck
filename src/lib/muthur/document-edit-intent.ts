/** Detect when the user wants MUTHUR to change the open operator document. */
export function isDocumentEditIntent(message: string): boolean {
  const lower = message.toLowerCase();
  const wantsEdit = /\b(remove|delete|fix|edit|change|replace|add|rewrite|update|typo|cut)\b/.test(lower);
  const docRef =
    /\b(document|doc|file|operator|markdown|paragraph|line|text|resume|cv|heading|title)\b/.test(lower) ||
    /\bfrom my\b/.test(lower);
  return wantsEdit && docRef;
}

export function isDocxFileName(name: string | null | undefined): boolean {
  return Boolean(name?.trim().toLowerCase().endsWith(".docx"));
}

export type OperatorChatContext = {
  previewSurface?: string | null;
  fileName?: string | null;
  localFilePath?: string | null;
  docMode?: "view" | "edit" | null;
};

export function formatOperatorChatContextPrompt(ctx: OperatorChatContext | null | undefined): string {
  if (!ctx?.fileName?.trim()) return "";
  const lines = [
    "\n\nOperator pane context (from client):",
    `File: ${ctx.fileName}`,
    ctx.previewSurface ? `Surface: ${ctx.previewSurface}` : null,
    ctx.localFilePath ? `Path: ${ctx.localFilePath}` : null,
    ctx.docMode ? `Mode: ${ctx.docMode}` : null,
    "Edits apply immediately in the operator pane (Ctrl+Z to undo).",
  ].filter(Boolean);
  if (isDocxFileName(ctx.fileName)) {
    lines.push(
      "DOCX is open — do NOT use justbash/find or localfs to search for this file.",
      "For text edits: call convert_document_to_markdown with filePath above, then suggest_operator_edit on the converted markdown in the operator pane.",
    );
  }
  return lines.join("\n");
}
