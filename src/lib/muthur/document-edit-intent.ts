/** Detect when the user wants MUTHUR to change the open operator document. */
export function isDocumentEditIntent(message: string): boolean {
  const lower = message.toLowerCase();
  const wantsEdit = /\b(remove|delete|fix|edit|change|replace|add|rewrite|update|typo|cut)\b/.test(lower);
  const docRef =
    /\b(document|doc|file|operator|markdown|paragraph|line|text|resume|cv|heading|title|top|bottom)\b/.test(
      lower,
    ) ||
    /\b(at the top|at the bottom|first line|last line)\b/.test(lower) ||
    /<!--[\s\S]*?-->/.test(message) ||
    /\bfrom my\b/.test(lower);
  return wantsEdit && docRef;
}

/** Edit request while a file is already open in the operator pane (broader than docRef keywords). */
export function isOperatorPaneEditRequest(
  message: string,
  ctx?: OperatorChatContext | null,
): boolean {
  if (isDocumentEditIntent(message)) return true;
  if (!ctx?.localFilePath?.trim() && !ctx?.fileName?.trim()) return false;
  const lower = message.toLowerCase();
  return /\b(remove|delete|fix|edit|change|replace|add|rewrite|update|typo|cut)\b/.test(lower);
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
  } else if (ctx.localFilePath || ctx.previewSurface === "markdown" || ctx.previewSurface === "text") {
    lines.push(
      "File is open in the operator pane — use observe_operator_pane then suggest_operator_edit.",
      "Do NOT use localfs write on this open file; in-pane edits apply immediately (Ctrl+Z to undo).",
    );
  }
  return lines.join("\n");
}
