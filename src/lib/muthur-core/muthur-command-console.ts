import { formatMuthurLiveStreamDisplay } from "@/lib/muthur-core/muthur-stream-payload";
import {
  formatInhabitantChannelLabel,
  normalizeMuthurInhabitant,
  type MuthurInhabitant,
} from "@/lib/muthur/muthur-inhabitant";

export type MuthurChatMessage = {
  role: string;
  text: string;
  toolTrace?: string;
  inhabitant?: MuthurInhabitant;
};

export type MuthurChatTurn = {
  id: string;
  user?: MuthurChatMessage;
  assistant?: MuthurChatMessage;
  diagnostics: MuthurChatMessage[];
};

export type MuthurResponsePhase = "idle" | "composing" | "complete" | "failed" | "stalled";

const DIAGNOSTIC_PREFIX_RE =
  /^\[(?:SYS|TOOLS|QUEUE|RENDER|HEALTH|ERR|UPLINK|OPERATOR|BROWSER|VERIFY|KEY|MODEL)/i;

export function isMuthurChannelMessage(message: MuthurChatMessage): boolean {
  return message.role === "user" || message.role === "assistant";
}

export function isDiagnosticMessage(message: MuthurChatMessage): boolean {
  return !isMuthurChannelMessage(message);
}

export function resolveMuthurAssistantLabel(message: MuthurChatMessage): string {
  return formatInhabitantChannelLabel(normalizeMuthurInhabitant(message.inhabitant ?? "muthur"));
}

export function inhabitantChannelClass(inhabitant?: MuthurInhabitant | null): string {
  const resolved = normalizeMuthurInhabitant(inhabitant ?? "muthur");
  switch (resolved) {
    case "codex":
      return "text-amber-300";
    case "pi":
      return "text-cyan-300";
    case "muthur":
      return "text-green-400";
    default: {
      const _exhaustive: never = resolved;
      return _exhaustive;
    }
  }
}

export function formatDiagnosticLabel(text: string): string {
  const trimmed = text.trim();
  if (/^⏳ MUTHUR/i.test(trimmed)) return "QUEUE";
  if (/OPERATOR|BROWSER|VERIFY|UPLINK|KEY FOR|MODEL_CONNECTED|RENDER|HEALTH|\[SYS\]/i.test(trimmed)) {
    if (/OPERATOR EDIT|OPERATOR OPEN|OPERATOR CONVERT|OPERATOR SYNC/i.test(trimmed)) return "TOOLS";
    if (/BROWSER_/i.test(trimmed)) return "TOOLS";
    if (/VERIFY|CODING/i.test(trimmed)) return "HEALTH";
    if (/UPLINK|TIMEOUT|ABORT/i.test(trimmed)) return "QUEUE";
    if (/MODEL_CONNECTED|KEY FOR|NO_MODEL/i.test(trimmed)) return "HEALTH";
    return "SYS";
  }
  if (/^\[TOOLS\]/i.test(trimmed) || /MUTHUR_TOOLS|tool/i.test(trimmed)) return "TOOLS";
  if (/^\[REASONING\]/i.test(trimmed)) return "REASONING";
  if (/^\[COGNITION/i.test(trimmed)) return "COGNITION";
  if (/fail|error|invalid|rejected/i.test(trimmed)) return "ERR";
  if (DIAGNOSTIC_PREFIX_RE.test(trimmed)) {
    const match = trimmed.match(/^\[([A-Z]+)\]/i);
    if (match?.[1]) return match[1].toUpperCase();
  }
  return "SYS";
}

export function toolTraceToDiagnostic(toolTrace: string): MuthurChatMessage {
  const tools = toolTrace
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .join(" · ");
  return {
    role: "system",
    text: `[TOOLS] ${tools}`,
  };
}

/** Group flat chat log into operator turns; diagnostics never sit in the MUTHUR channel. */
export function groupMuthurChatTurns(messages: MuthurChatMessage[]): MuthurChatTurn[] {
  const turns: MuthurChatTurn[] = [];
  let current: MuthurChatTurn | null = null;

  const pushDiagnostic = (message: MuthurChatMessage, index: number) => {
    if (!current) {
      turns.push({ id: `diag-${index}`, diagnostics: [message] });
      return;
    }
    current.diagnostics.push(message);
  };

  messages.forEach((message, index) => {
    if (message.role === "user") {
      if (current) turns.push(current);
      current = { id: `turn-${index}`, user: message, diagnostics: [] };
      return;
    }

    if (message.role === "assistant") {
      if (!current) current = { id: `turn-${index}`, diagnostics: [] };
      current.assistant = { ...message, toolTrace: undefined };
      if (message.toolTrace?.trim()) {
        current.diagnostics.push(toolTraceToDiagnostic(message.toolTrace));
      }
      return;
    }

    pushDiagnostic(message, index);
  });

  if (current) turns.push(current);
  return turns;
}

export function collectAllDiagnostics(turns: MuthurChatTurn[]): MuthurChatMessage[] {
  return turns.flatMap((turn) => turn.diagnostics);
}

export function collectMuthurToolHistory(turns: MuthurChatTurn[]): MuthurChatMessage[] {
  return collectAllDiagnostics(turns).filter(
    (message) => formatDiagnosticLabel(message.text) === "TOOLS",
  );
}

/** Scroll when MUTHUR response body changes — not when diagnostics append afterward. */
export function buildMuthurResponseScrollKey(
  messages: MuthurChatMessage[],
  streamText: string,
  isStreaming: boolean,
): string {
  const assistants = messages.filter((message) => message.role === "assistant");
  const last = assistants.at(-1);
  const streamBody = formatMuthurStreamBody(streamText);
  return [
    assistants.length,
    last?.text.length ?? 0,
    streamBody.length,
    isStreaming ? 1 : 0,
  ].join(":");
}

/** Scroll key for the full chat column (messages, stream, progress, diagnostics). */
export function buildMuthurChatScrollKey(args: {
  messages: MuthurChatMessage[];
  streamText: string;
  isStreaming: boolean;
  streamToolTrace: string;
  diagnosticsEntryCount: number;
  lastDiagnosticId?: string;
  lastDiagnosticRepeatCount?: number;
  responseStallElapsedMs?: number;
  cognitionStatusLine?: string | null;
}): string {
  const last = args.messages.at(-1);
  const streamBody = formatMuthurStreamBody(args.streamText);
  const progressStatus = extractMuthurProgressStatus(args.streamText);
  return [
    args.messages.length,
    last?.role ?? "",
    last?.text.length ?? 0,
    streamBody.length,
    progressStatus,
    args.isStreaming ? 1 : 0,
    args.streamToolTrace,
    args.diagnosticsEntryCount,
    args.lastDiagnosticId ?? "",
    args.lastDiagnosticRepeatCount ?? 0,
    args.responseStallElapsedMs ?? 0,
    args.cognitionStatusLine ?? "",
  ].join(":");
}

export function resolveMuthurResponsePhase(args: {
  isStreaming: boolean;
  streamText: string;
  messages: MuthurChatMessage[];
  failed?: boolean;
  stalled?: boolean;
}): MuthurResponsePhase {
  if (args.stalled) return "stalled";
  if (args.failed) return "failed";
  if (args.isStreaming || args.streamText.trim()) return "composing";
  const lastUserIndex = messagesFindLastUserIndex(args.messages);
  const hasAssistantAfterLastUser =
    lastUserIndex >= 0 &&
    args.messages.slice(lastUserIndex + 1).some((message) => message.role === "assistant");
  if (hasAssistantAfterLastUser) return "complete";
  return "idle";
}

function messagesFindLastUserIndex(messages: MuthurChatMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === "user") return i;
  }
  return -1;
}

/** Commit assistant to channel state without waiting for diagnostics side effects. */
export function commitMuthurAssistantTurn(args: {
  messages: MuthurChatMessage[];
  text: string;
  toolTrace?: string;
}): MuthurChatMessage[] {
  const trimmed = args.text.trim();
  const entry: MuthurChatMessage = {
    role: "assistant",
    text: trimmed,
    ...(args.toolTrace?.trim() ? { toolTrace: args.toolTrace.trim() } : {}),
  };
  return [...args.messages, entry];
}

/** Live stream body for the MUTHUR channel (progress lines belong in diagnostics / status). */
export function formatMuthurStreamBody(text: string): string {
  const body = formatMuthurLiveStreamDisplay(text);
  if (/^⏳ MUTHUR/i.test(body.trim())) return "";
  return body;
}

export function extractMuthurProgressStatus(text: string): string {
  const lines = [...text.matchAll(/^⏳ MUTHUR[^\n]*/gm)].map((match) => match[0]);
  return lines.at(-1)?.trim() ?? "";
}

export function isLongMuthurResponse(text: string): boolean {
  return text.trim().length >= 2000;
}

export function countMuthurWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}
