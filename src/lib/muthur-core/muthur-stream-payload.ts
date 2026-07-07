import type { OperatorEditorEdit } from "@/lib/operator-workbench";
import type {
  MuthurCodingVerifyReceipt,
  MuthurOperatorBrowserRef,
  MuthurOperatorConversionRef,
  MuthurOperatorOpenFileRef,
  MuthurSurveyAutoConnectRef,
} from "@/lib/muthur-core/types";
import { parseOperatorBrowserJson } from "@/lib/muthur-core/operator-browser-ref";
import { parseOperatorConversionJson } from "@/lib/muthur-core/operator-conversion-ref";
import { parseOperatorOpenJson } from "@/lib/muthur-core/operator-open-file-ref";
import { parseSurveyAutoConnectJson } from "@/lib/muthur-core/survey-auto-connect-ref";
import { stripDsmlToolMarkup } from "@/lib/muthur-core/parse-dsml-tool-calls";
import { stripPiControlLeaseStreamMarkers } from "@/lib/muthur/control/pi-control-lease-stream";
import { extractMuthurStreamReasoning } from "@/lib/muthur-core/muthur-stream-reasoning";

const OPERATOR_EDITS_FOOTER_RE =
  /\n\n\[MUTHUR_OPERATOR_EDITS\]([\s\S]*?)\[\/MUTHUR_OPERATOR_EDITS\]\s*$/;
const OPERATOR_CONVERSION_FOOTER_RE =
  /\n\n\[MUTHUR_OPERATOR_CONVERSION\]([\s\S]*?)\[\/MUTHUR_OPERATOR_CONVERSION\]\s*$/;
const OPERATOR_OPEN_FOOTER_RE =
  /\n\n\[MUTHUR_OPERATOR_OPEN\]([\s\S]*?)\[\/MUTHUR_OPERATOR_OPEN\]\s*$/;
const OPERATOR_BROWSER_FOOTER_RE =
  /\n\n\[MUTHUR_OPERATOR_BROWSER\]([\s\S]*?)\[\/MUTHUR_OPERATOR_BROWSER\]\s*$/;
const SURVEY_AUTO_CONNECT_FOOTER_RE =
  /\n\n\[MUTHUR_SURVEY_AUTO_CONNECT\]([\s\S]*?)\[\/MUTHUR_SURVEY_AUTO_CONNECT\]\s*$/;
const VERIFY_RECEIPT_FOOTER_RE =
  /\n\n\[MUTHUR_VERIFY_RECEIPT\]([\s\S]*?)\[\/MUTHUR_VERIFY_RECEIPT\]\s*$/;
const TOOLS_USED_FOOTER_RE = /\n\n\[MUTHUR_TOOLS_USED\]([\s\S]*?)\[\/MUTHUR_TOOLS_USED\]/;

const MUTHUR_PROGRESS_LINE_RE = /^⏳ MUTHUR[^\n]*\n?/gm;
const UPLINK_PROGRESS_RE = /^⏳ MUTHUR[^\n]*\n/gm;
const CODING_VERIFY_INLINE_RE =
  /\n⏳ MUTHUR \/\/ verify:[^\n]*\n(?:\n\[MUTHUR_VERIFY\][\s\S]*?)(?=\n\n\[MUTHUR_|$)/;

/** Shown client-side before /api/cyberdeck-chat returns its first byte. */
export const MUTHUR_UPLINK_PREPARING = "⏳ MUTHUR // preparing uplink...";

function dedupeConsecutiveProgressLines(lines: string[]): string[] {
  const stages: string[] = [];
  for (const line of lines) {
    if (stages.at(-1) !== line) stages.push(line);
  }
  return stages;
}

/** During uplink streaming, show recent progress stages until real reply text arrives. */
export function formatMuthurLiveStreamDisplay(text: string): string {
  const { body: withoutReasoning } = extractMuthurStreamReasoning(text);
  const progressLines = [...withoutReasoning.matchAll(/^⏳ MUTHUR[^\n]*/gm)].map((match) => match[0]);
  const latestProgress = progressLines.at(-1) ?? "";

  let body = withoutReasoning
    .replace(MUTHUR_PROGRESS_LINE_RE, "")
    .replace(CODING_VERIFY_INLINE_RE, "")
    .replace(TOOLS_USED_FOOTER_RE, "")
    .trim();

  body = stripDsmlToolMarkup(body)
    .replace(/^=+\s*$/gm, "")
    .replace(/^=+$\n?/g, "")
    .trim();
  body = stripPiControlLeaseStreamMarkers(body);

  if (body) return body;

  const stages = dedupeConsecutiveProgressLines(progressLines);
  if (stages.length <= 1) return latestProgress;
  return stages.slice(-4).join("\n");
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
  operatorBrowser?: MuthurOperatorBrowserRef | null,
  surveyAutoConnect?: MuthurSurveyAutoConnectRef | null,
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
  if (operatorBrowser) {
    out += `\n\n[MUTHUR_OPERATOR_BROWSER]${JSON.stringify(operatorBrowser)}[/MUTHUR_OPERATOR_BROWSER]`;
  }
  if (surveyAutoConnect) {
    out += `\n\n[MUTHUR_SURVEY_AUTO_CONNECT]${JSON.stringify(surveyAutoConnect)}[/MUTHUR_SURVEY_AUTO_CONNECT]`;
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
  operatorBrowser: MuthurOperatorBrowserRef | null;
  surveyAutoConnect: MuthurSurveyAutoConnectRef | null;
  codingVerify: MuthurCodingVerifyReceipt | null;
  toolsUsed: string;
} {
  let body = text;
  let operatorEdits: OperatorEditorEdit[] = [];
  let operatorConversion: MuthurOperatorConversionRef | null = null;
  let operatorOpenFile: MuthurOperatorOpenFileRef | null = null;
  let operatorBrowser: MuthurOperatorBrowserRef | null = null;
  let surveyAutoConnect: MuthurSurveyAutoConnectRef | null = null;
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

  const browserMatch = body.match(OPERATOR_BROWSER_FOOTER_RE);
  if (browserMatch) {
    body = body.slice(0, browserMatch.index ?? body.length);
    operatorBrowser = parseOperatorBrowserJson(browserMatch[1]);
  }

  const surveyMatch = body.match(SURVEY_AUTO_CONNECT_FOOTER_RE);
  if (surveyMatch) {
    body = body.slice(0, surveyMatch.index ?? body.length);
    surveyAutoConnect = parseSurveyAutoConnectJson(surveyMatch[1]);
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

  const displayText = stripPiControlLeaseStreamMarkers(
    extractMuthurStreamReasoning(
      stripDsmlToolMarkup(body)
        .replace(CODING_VERIFY_INLINE_RE, "")
        .replace(UPLINK_PROGRESS_RE, "")
        .replace(/^=+$\n?/gm, "")
        .trim(),
    ).body,
  );
  return { displayText, operatorEdits, operatorConversion, operatorOpenFile, operatorBrowser, surveyAutoConnect, codingVerify, toolsUsed };
}

/** Pick text to commit after uplink — never drop a visible stream body when footers strip to empty. */
export function resolveMuthurCommittedDisplayText(args: {
  fullText: string;
  streamDisplayText: string;
  glyphDisplayText: string;
  toolsUsed?: string;
}): string {
  const fromGlyph = args.glyphDisplayText.replace(/^=+$\n?/g, "").trim();
  if (fromGlyph) return fromGlyph;

  const fromStream = args.streamDisplayText
    .replace(/^⏳ MUTHUR[^\n]*\n?/gm, "")
    .replace(/^=+$\n?/g, "")
    .trim();
  if (fromStream) return fromStream;

  const fromPayload = splitMuthurStreamPayload(args.fullText).displayText.trim();
  if (fromPayload) return fromPayload;

  const tools = (args.toolsUsed ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (tools.length > 0) {
    return `Tools used: ${tools.join(" · ")}`;
  }

  return "";
}
