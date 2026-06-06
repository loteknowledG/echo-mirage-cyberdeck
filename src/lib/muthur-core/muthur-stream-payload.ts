import type { OperatorEditorEdit } from "@/lib/operator-workbench";
import { stripDsmlToolMarkup } from "@/lib/muthur-core/parse-dsml-tool-calls";

const OPERATOR_EDITS_FOOTER_RE =
  /\n\n\[MUTHUR_OPERATOR_EDITS\]([\s\S]*?)\[\/MUTHUR_OPERATOR_EDITS\]\s*$/;
const TOOLS_USED_FOOTER_RE = /\n\n\[MUTHUR_TOOLS_USED\]([\s\S]*?)\[\/MUTHUR_TOOLS_USED\]/;

const UPLINK_PROGRESS_RE = /^⏳ MUTHUR[^\n]*\n/gm;

function parseEditsJson(raw: string): OperatorEditorEdit[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is OperatorEditorEdit =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as OperatorEditorEdit).kind === "string" &&
        typeof (item as OperatorEditorEdit).text === "string",
    );
  } catch {
    return [];
  }
}

export function appendMuthurStreamFooters(
  text: string,
  toolsUsed: string[],
  operatorEdits: OperatorEditorEdit[],
): string {
  let out = text;
  if (toolsUsed.length > 0) {
    out += `\n\n[MUTHUR_TOOLS_USED]${toolsUsed.join(",")}[/MUTHUR_TOOLS_USED]`;
  }
  if (operatorEdits.length > 0) {
    out += `\n\n[MUTHUR_OPERATOR_EDITS]${JSON.stringify(operatorEdits)}[/MUTHUR_OPERATOR_EDITS]`;
  }
  return out;
}

/** Strip uplink progress lines and machine footers from a completed MUTHUR stream. */
export function splitMuthurStreamPayload(text: string): {
  displayText: string;
  operatorEdits: OperatorEditorEdit[];
  toolsUsed: string;
} {
  let body = text;
  let operatorEdits: OperatorEditorEdit[] = [];

  const editsMatch = body.match(OPERATOR_EDITS_FOOTER_RE);
  if (editsMatch) {
    body = body.slice(0, editsMatch.index ?? body.length);
    operatorEdits = parseEditsJson(editsMatch[1]);
  }

  let toolsUsed = "";
  const toolsMatch = body.match(TOOLS_USED_FOOTER_RE);
  if (toolsMatch) {
    body = body.replace(TOOLS_USED_FOOTER_RE, "");
    toolsUsed = toolsMatch[1].trim();
  }

  const displayText = stripDsmlToolMarkup(body)
    .replace(UPLINK_PROGRESS_RE, "")
    .replace(/^=+$\n?/gm, "")
    .trim();
  return { displayText, operatorEdits, toolsUsed };
}
