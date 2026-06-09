import type { OperatorEditorEdit } from "@/lib/operator-workbench";
import type {
  MuthurCodingVerifyReceipt,
  MuthurOperatorConversionRef,
  MuthurOperatorOpenFileRef,
} from "@/lib/muthur-core/types";
import { parseOperatorConversionJson } from "@/lib/muthur-core/operator-conversion-ref";
import { parseOperatorOpenJson } from "@/lib/muthur-core/operator-open-file-ref";
import { stripDsmlToolMarkup } from "@/lib/muthur-core/parse-dsml-tool-calls";

const OPERATOR_EDITS_FOOTER_RE =
  /\n\n\[MUTHUR_OPERATOR_EDITS\]([\s\S]*?)\[\/MUTHUR_OPERATOR_EDITS\]\s*$/;
const OPERATOR_CONVERSION_FOOTER_RE =
  /\n\n\[MUTHUR_OPERATOR_CONVERSION\]([\s\S]*?)\[\/MUTHUR_OPERATOR_CONVERSION\]\s*$/;
const OPERATOR_OPEN_FOOTER_RE =
  /\n\n\[MUTHUR_OPERATOR_OPEN\]([\s\S]*?)\[\/MUTHUR_OPERATOR_OPEN\]\s*$/;
const VERIFY_RECEIPT_FOOTER_RE =
  /\n\n\[MUTHUR_VERIFY_RECEIPT\]([\s\S]*?)\[\/MUTHUR_VERIFY_RECEIPT\]\s*$/;
const TOOLS_USED_FOOTER_RE = /\n\n\[MUTHUR_TOOLS_USED\]([\s\S]*?)\[\/MUTHUR_TOOLS_USED\]/;

const MUTHUR_PROGRESS_LINE_RE = /^⏳ MUTHUR[^\n]*\n?/gm;
const UPLINK_PROGRESS_RE = /^⏳ MUTHUR[^\n]*\n/gm;
const CODING_VERIFY_INLINE_RE =
  /\n⏳ MUTHUR \/\/ verify:[^\n]*\n(?:\n\[MUTHUR_VERIFY\][\s\S]*?)(?=\n\n\[MUTHUR_|$)/;

/** During uplink streaming, show only the latest progress line until real reply text arrives. */
export function formatMuthurLiveStreamDisplay(text: string): string {
  const progressLines = [...text.matchAll(/^⏳ MUTHUR[^\n]*/gm)].map((match) => match[0]);
  const latestProgress = progressLines.at(-1) ?? "";

  let body = text
    .replace(MUTHUR_PROGRESS_LINE_RE, "")
    .replace(CODING_VERIFY_INLINE_RE, "")
    .replace(TOOLS_USED_FOOTER_RE, "")
    .trim();

  body = stripDsmlToolMarkup(body)
    .replace(/^=+\s*$/gm, "")
    .replace(/^=+$\n?/g, "")
    .trim();

  if (body) return body;
  return latestProgress;
}

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

function parseCodingVerifyJson(raw: string): MuthurCodingVerifyReceipt | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const r = parsed as MuthurCodingVerifyReceipt;
    if (typeof r.passed !== "boolean" || !Array.isArray(r.touched_paths)) return null;
    return r;
  } catch {
    return null;
  }
}

export function appendMuthurStreamFooters(
  text: string,
  toolsUsed: string[],
  operatorEdits: OperatorEditorEdit[],
  operatorConversion?: MuthurOperatorConversionRef | null,
  operatorOpenFile?: MuthurOperatorOpenFileRef | null,
  codingVerify?: MuthurCodingVerifyReceipt | null,
): string {
  let out = text;
  if (toolsUsed.length > 0) {
    out += `\n\n[MUTHUR_TOOLS_USED]${toolsUsed.join(",")}[/MUTHUR_TOOLS_USED]`;
  }
  if (operatorConversion) {
    out += `\n\n[MUTHUR_OPERATOR_CONVERSION]${JSON.stringify(operatorConversion)}[/MUTHUR_OPERATOR_CONVERSION]`;
  }
  if (operatorOpenFile) {
    out += `\n\n[MUTHUR_OPERATOR_OPEN]${JSON.stringify(operatorOpenFile)}[/MUTHUR_OPERATOR_OPEN]`;
  }
  if (operatorEdits.length > 0) {
    out += `\n\n[MUTHUR_OPERATOR_EDITS]${JSON.stringify(operatorEdits)}[/MUTHUR_OPERATOR_EDITS]`;
  }
  if (codingVerify) {
    out += `\n\n[MUTHUR_VERIFY_RECEIPT]${JSON.stringify(codingVerify)}[/MUTHUR_VERIFY_RECEIPT]`;
  }
  return out;
}

/** Strip uplink progress lines and machine footers from a completed MUTHUR stream. */
export function splitMuthurStreamPayload(text: string): {
  displayText: string;
  operatorEdits: OperatorEditorEdit[];
  operatorConversion: MuthurOperatorConversionRef | null;
  operatorOpenFile: MuthurOperatorOpenFileRef | null;
  codingVerify: MuthurCodingVerifyReceipt | null;
  toolsUsed: string;
} {
  let body = text;
  let operatorEdits: OperatorEditorEdit[] = [];
  let operatorConversion: MuthurOperatorConversionRef | null = null;
  let operatorOpenFile: MuthurOperatorOpenFileRef | null = null;
  let codingVerify: MuthurCodingVerifyReceipt | null = null;

  const verifyMatch = body.match(VERIFY_RECEIPT_FOOTER_RE);
  if (verifyMatch) {
    body = body.slice(0, verifyMatch.index ?? body.length);
    codingVerify = parseCodingVerifyJson(verifyMatch[1]);
  }

  const editsMatch = body.match(OPERATOR_EDITS_FOOTER_RE);
  if (editsMatch) {
    body = body.slice(0, editsMatch.index ?? body.length);
    operatorEdits = parseEditsJson(editsMatch[1]);
  }

  const openMatch = body.match(OPERATOR_OPEN_FOOTER_RE);
  if (openMatch) {
    body = body.slice(0, openMatch.index ?? body.length);
    operatorOpenFile = parseOperatorOpenJson(openMatch[1]);
  }

  const conversionMatch = body.match(OPERATOR_CONVERSION_FOOTER_RE);
  if (conversionMatch) {
    body = body.slice(0, conversionMatch.index ?? body.length);
    operatorConversion = parseOperatorConversionJson(conversionMatch[1]);
  }

  let toolsUsed = "";
  const toolsMatch = body.match(TOOLS_USED_FOOTER_RE);
  if (toolsMatch) {
    body = body.replace(TOOLS_USED_FOOTER_RE, "");
    toolsUsed = toolsMatch[1].trim();
  }

  const displayText = stripDsmlToolMarkup(body)
    .replace(CODING_VERIFY_INLINE_RE, "")
    .replace(UPLINK_PROGRESS_RE, "")
    .replace(/^=+$\n?/gm, "")
    .trim();
  return { displayText, operatorEdits, operatorConversion, operatorOpenFile, codingVerify, toolsUsed };
}
