import type { OperatorEditorEdit } from "@/lib/operator-workbench";

function describeEdit(edit: OperatorEditorEdit): string {
  switch (edit.kind) {
    case "replace_line_range":
      return `lines ${edit.startLine}–${edit.endLine}`;
    case "replace_content":
      return "full document";
    case "append_section":
      return "append section";
    case "insert_at_cursor":
      return "insert at cursor";
    case "replace_selection":
      return "replace selection";
    default:
      return "edit";
  }
}

/** Client fallback when the model returns no visible reply after operator edits. */
export function summarizeMuthurOperatorEdits(
  edits: OperatorEditorEdit[],
  fileName: string,
  userMessage: string,
): string {
  const target = fileName || "open document";
  const editBits = edits.map(describeEdit).join(", ");
  const request = userMessage.trim().slice(0, 120);
  const requestHint = request ? ` for: “${request}${userMessage.length > 120 ? "…" : ""}”` : "";

  if (edits.length === 1 && edits[0].kind === "replace_line_range") {
    const { startLine, endLine } = edits[0];
    if (startLine === endLine) {
      return `Updated line ${startLine} of ${target}${requestHint}. Ctrl+Z to undo in the operator pane.`;
    }
  }

  return `Applied ${edits.length} edit(s) (${editBits}) to ${target}${requestHint}. Ctrl+Z to undo in the operator pane.`;
}
