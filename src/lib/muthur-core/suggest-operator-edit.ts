import type { OperatorEditorEdit } from "@/lib/operator-workbench";

const MAX_EDIT_TEXT_BYTES = 512 * 1024;

export type ParsedOperatorEditorEdit =
  | { ok: true; edit: OperatorEditorEdit }
  | { ok: false; error: string };

function readString(args: Record<string, unknown>, key: string): string {
  const raw = args[key];
  return typeof raw === "string" ? raw : "";
}

function readPositiveInt(args: Record<string, unknown>, key: string): number | null {
  const raw = args[key];
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 1) {
    return Math.floor(raw);
  }
  if (typeof raw === "string" && /^\d+$/.test(raw.trim())) {
    return Math.max(1, Number.parseInt(raw.trim(), 10));
  }
  return null;
}

export function parseSuggestOperatorEditArgs(args: Record<string, unknown>): ParsedOperatorEditorEdit {
  const kind = readString(args, "kind").trim() as OperatorEditorEdit["kind"];
  const text = readString(args, "text");

  if (!kind) {
    return { ok: false, error: 'suggest_operator_edit requires "kind".' };
  }
  if (!text && kind !== "replace_content") {
    return { ok: false, error: 'suggest_operator_edit requires non-empty "text".' };
  }
  if (Buffer.byteLength(text, "utf8") > MAX_EDIT_TEXT_BYTES) {
    return { ok: false, error: "Edit text exceeds 512KB limit." };
  }

  switch (kind) {
    case "replace_content":
      return { ok: true, edit: { kind, text } };
    case "insert_at_cursor":
      return { ok: true, edit: { kind, text } };
    case "replace_selection":
      return { ok: true, edit: { kind, text } };
    case "append_section":
      return { ok: true, edit: { kind, text } };
    case "replace_line_range": {
      const startLine = readPositiveInt(args, "startLine") ?? readPositiveInt(args, "start_line");
      const endLine = readPositiveInt(args, "endLine") ?? readPositiveInt(args, "end_line");
      if (startLine == null || endLine == null) {
        return {
          ok: false,
          error: 'replace_line_range requires startLine and endLine (1-based, inclusive).',
        };
      }
      return { ok: true, edit: { kind, startLine, endLine, text } };
    }
    default:
      return {
        ok: false,
        error: `Unsupported edit kind: ${kind}. Use replace_content, replace_line_range, insert_at_cursor, append_section, or replace_selection.`,
      };
  }
}

const EDIT_KINDS = new Set<OperatorEditorEdit["kind"]>([
  "replace_content",
  "replace_line_range",
  "insert_at_cursor",
  "append_section",
  "replace_selection",
]);

export function extractOperatorEditFromToolOutput(output: unknown): OperatorEditorEdit | null {
  if (!output || typeof output !== "object") return null;
  const edit = (output as { edit?: unknown }).edit;
  if (!edit || typeof edit !== "object") return null;
  const kind = (edit as OperatorEditorEdit).kind;
  if (!EDIT_KINDS.has(kind)) return null;
  if (typeof (edit as OperatorEditorEdit).text !== "string") return null;
  if (kind === "replace_line_range") {
    const rangeEdit = edit as Extract<OperatorEditorEdit, { kind: "replace_line_range" }>;
    if (
      typeof rangeEdit.startLine !== "number" ||
      typeof rangeEdit.endLine !== "number" ||
      rangeEdit.startLine < 1 ||
      rangeEdit.endLine < rangeEdit.startLine
    ) {
      return null;
    }
  }
  return edit as OperatorEditorEdit;
}

export function formatSuggestOperatorEditResult(output: unknown): string {
  if (!output || typeof output !== "object") {
    return "[TOOL OK] suggest_operator_edit\n\nQueued for operator review.";
  }
  const record = output as { edit?: OperatorEditorEdit; fileName?: string | null };
  const kind = record.edit?.kind ?? "unknown";
  const fileHint = record.fileName ? `\nTarget file: ${record.fileName}` : "";
  return (
    `[TOOL OK] suggest_operator_edit // APPLIED_IN_OPERATOR\n\n` +
    `Edit kind: ${kind}${fileHint}\n` +
    `Change applies in the operator pane immediately. Ctrl+Z to undo; save when ready.`
  );
}
