import {
  surveyAutoConnectFailureMessage,
  tryExecuteSurveyAutoConnectFromChat,
} from "@/lib/cyberdeck/survey-muthur-connect.client";
import { parseEntityAtlasQuery, type EntityAtlasQueryIntent } from "@/lib/entity-atlas/entity-atlas-query";
import { parseMemoryAtlasQuery, type MemoryAtlasQueryIntent } from "@/lib/memory-atlas/memory-atlas-query";
import {
  getMuthurHelpText,
  getMuthurHelpUnknownTopicText,
  parseMuthurClearChatIntent,
  parseMuthurHelpIntent,
} from "@/lib/muthur-help-text";
import { resolveGlyphCommand, type GlyphCommand } from "@/lib/muthur-glyph-intent";
import {
  CHAT_STORAGE_KEY,
  CHAT_STREAM_STORAGE_KEY,
} from "@/features/cyberdeck/muthur/muthur-chat-types";
import type { ChatMessage } from "@/features/cyberdeck/muthur/muthur-chat-types";
import {
  appendMuthurDiagnosticEntry,
  createEmptyMuthurDiagnosticsState,
  type MuthurDiagnosticsState,
} from "@/lib/muthur-core/muthur-diagnostics-channel";
import type { SetStateAction } from "react";

export type MuthurHelpSendIntent = NonNullable<ReturnType<typeof parseMuthurHelpIntent>>;

export type MuthurPostUplinkSendIntent =
  | { kind: "help"; intent: MuthurHelpSendIntent }
  | { kind: "entity-atlas"; intent: EntityAtlasQueryIntent }
  | { kind: "memory-atlas"; intent: MemoryAtlasQueryIntent };

export function isMuthurClearChatIntent(userMessage: string): boolean {
  return parseMuthurClearChatIntent(userMessage);
}

export function classifySurveyGlyphSendIntent(userMessage: string): GlyphCommand | null {
  return resolveGlyphCommand(userMessage);
}

export function classifyHelpAtlasSendIntent(userMessage: string): MuthurPostUplinkSendIntent | null {
  const helpIntent = parseMuthurHelpIntent(userMessage);
  if (helpIntent) {
    return { kind: "help", intent: helpIntent };
  }

  const entityAtlasIntent = parseEntityAtlasQuery(userMessage);
  if (entityAtlasIntent) {
    return { kind: "entity-atlas", intent: entityAtlasIntent };
  }

  const memoryAtlasIntent = parseMemoryAtlasQuery(userMessage);
  if (memoryAtlasIntent) {
    return { kind: "memory-atlas", intent: memoryAtlasIntent };
  }

  return null;
}

export type MuthurSendIntentMessageOps = {
  setMessages: (updater: SetStateAction<ChatMessage[]>) => void;
  setMuthurDiagnostics: (updater: SetStateAction<MuthurDiagnosticsState>) => void;
  setIsStreaming: (value: boolean) => void;
  setStreamText: (value: string) => void;
  setStreamToolTrace: (value: string) => void;
  setMuthurStall: (value: null) => void;
  composeStartedAtRef: { current: number | null };
};

export type MuthurClearChatDeps = MuthurSendIntentMessageOps & {
  abortMotherSpeech: () => void;
  chatAbortRef: { current: AbortController | null };
  steerPendingRef: { current: unknown };
  steerAbortRef: { current: boolean };
  setMuthurResponseFailed: (value: boolean) => void;
  setChatKeyboardHighlightIndex: (value: number | null) => void;
  setGeneratedUI: (value: string | null) => void;
  screenshotRef: { current: unknown };
  messageInputRef: { current: { clear: () => void } | null };
};

export function executeMuthurClearChat(deps: MuthurClearChatDeps): void {
  deps.steerPendingRef.current = null;
  deps.steerAbortRef.current = false;
  deps.abortMotherSpeech();
  if (deps.chatAbortRef.current) {
    deps.chatAbortRef.current.abort();
    deps.chatAbortRef.current = null;
  }
  deps.setIsStreaming(false);
  deps.setStreamText("");
  deps.setStreamToolTrace("");
  deps.setMessages([]);
  deps.setMuthurDiagnostics(createEmptyMuthurDiagnosticsState());
  deps.setMuthurStall(null);
  deps.setMuthurResponseFailed(false);
  deps.composeStartedAtRef.current = null;
  deps.setChatKeyboardHighlightIndex(null);
  deps.setGeneratedUI(null);
  deps.screenshotRef.current = null;
  deps.messageInputRef.current?.clear();
  try {
    window.localStorage.removeItem(CHAT_STORAGE_KEY);
    window.localStorage.removeItem(CHAT_STREAM_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

export async function tryExecuteSurveyConnectIntent(
  userMessage: string,
  ops: MuthurSendIntentMessageOps,
): Promise<boolean> {
  try {
    const surveyConnectLine = await tryExecuteSurveyAutoConnectFromChat(userMessage);
    if (surveyConnectLine) {
      ops.setMessages((prev) => [...prev, { role: "system", text: surveyConnectLine }]);
      ops.setIsStreaming(false);
      return true;
    }
  } catch (err) {
    ops.setMessages((prev) => [
      ...prev,
      { role: "system", text: surveyAutoConnectFailureMessage(err) },
    ]);
    ops.setIsStreaming(false);
    return true;
  }
  return false;
}

export async function executeGlyphSendIntent(
  command: GlyphCommand,
  ops: MuthurSendIntentMessageOps,
  handleGlyphOperatorCommand: (command: GlyphCommand) => Promise<void>,
): Promise<void> {
  try {
    await handleGlyphOperatorCommand(command);
  } catch (err) {
    ops.setMessages((prev) => [
      ...prev,
      {
        role: "system",
        text: `GLYPH // FAILED // ${err instanceof Error ? err.message : "Glyph command failed"}`,
      },
    ]);
  }
  ops.setIsStreaming(false);
}

export function executeHelpSendIntent(
  intent: MuthurHelpSendIntent,
  ops: Pick<MuthurSendIntentMessageOps, "setMessages" | "setIsStreaming">,
): void {
  const helpText =
    intent.kind === "unknown"
      ? getMuthurHelpUnknownTopicText(intent.topic)
      : getMuthurHelpText(intent.topic);
  ops.setMessages((prev) => [...prev, { role: "assistant", text: helpText }]);
  ops.setIsStreaming(false);
}

function finishAtlasIntent(ops: MuthurSendIntentMessageOps): void {
  ops.setStreamText("");
  ops.setStreamToolTrace("");
  ops.setIsStreaming(false);
  ops.composeStartedAtRef.current = null;
  ops.setMuthurStall(null);
}

export async function executeEntityAtlasSendIntent(
  userMessage: string,
  ops: MuthurSendIntentMessageOps,
): Promise<void> {
  try {
    const res = await fetch("/api/muthur/entity-query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userMessage }),
    });
    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error || `Entity query failed (${res.status})`);
    }
    const payload = (await res.json()) as {
      handled?: boolean;
      response?: string;
      entity_type?: string;
      result?: Record<string, unknown>;
    };
    if (payload.handled && payload.response) {
      ops.setMessages((prev) => [...prev, { role: "assistant", text: payload.response! }]);
      const resultId =
        typeof payload.result?.id === "string"
          ? payload.result.id
          : typeof payload.result?.anchor_id === "string"
            ? payload.result.anchor_id
            : Array.isArray(payload.result?.related)
              ? (payload.result.related as Array<{ id?: string }>)
                  .map((entry) => entry.id)
                  .filter(Boolean)
                  .join(", ")
              : "none";
      const receiptLine = `ENTITY_ATLAS // type=${payload.entity_type ?? "unknown"} // id=${resultId}`;
      ops.setMuthurDiagnostics((current) => appendMuthurDiagnosticEntry(current, receiptLine));
    } else {
      ops.setMessages((prev) => [
        ...prev,
        {
          role: "system",
          text: "ENTITY_ATLAS // UNHANDLED // intent not recognized by server",
        },
      ]);
    }
  } catch (err) {
    ops.setMessages((prev) => [
      ...prev,
      {
        role: "system",
        text: `ENTITY_ATLAS // FAILED // ${err instanceof Error ? err.message : "unknown error"}`,
      },
    ]);
  }
  finishAtlasIntent(ops);
}

export async function executeMemoryAtlasSendIntent(
  userMessage: string,
  ops: MuthurSendIntentMessageOps,
): Promise<void> {
  try {
    const res = await fetch("/api/muthur/memory-query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userMessage }),
    });
    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error || `Memory query failed (${res.status})`);
    }
    const payload = (await res.json()) as {
      handled?: boolean;
      response?: string;
      memory_type?: string;
      result?: Record<string, unknown>;
    };
    if (payload.handled && payload.response) {
      ops.setMessages((prev) => [...prev, { role: "assistant", text: payload.response! }]);
      const resultId =
        typeof payload.result?.id === "string"
          ? payload.result.id
          : Array.isArray(payload.result?.threads)
            ? (payload.result.threads as Array<{ id?: string }>).map((t) => t.id).filter(Boolean).join(", ")
            : "none";
      const receiptLine = `MEMORY_ATLAS // type=${payload.memory_type ?? "unknown"} // id=${resultId}`;
      ops.setMuthurDiagnostics((current) => appendMuthurDiagnosticEntry(current, receiptLine));
    } else {
      ops.setMessages((prev) => [
        ...prev,
        {
          role: "system",
          text: "MEMORY_ATLAS // UNHANDLED // intent not recognized by server",
        },
      ]);
    }
  } catch (err) {
    ops.setMessages((prev) => [
      ...prev,
      {
        role: "system",
        text: `MEMORY_ATLAS // FAILED // ${err instanceof Error ? err.message : "unknown error"}`,
      },
    ]);
  }
  finishAtlasIntent(ops);
}

export async function dispatchHelpAtlasSendIntent(
  intent: MuthurPostUplinkSendIntent,
  userMessage: string,
  ops: MuthurSendIntentMessageOps,
): Promise<void> {
  switch (intent.kind) {
    case "help":
      executeHelpSendIntent(intent.intent, ops);
      return;
    case "entity-atlas":
      await executeEntityAtlasSendIntent(userMessage, ops);
      return;
    case "memory-atlas":
      await executeMemoryAtlasSendIntent(userMessage, ops);
      return;
    default: {
      const neverIntent: never = intent;
      throw new Error(`Unexpected help/atlas intent: ${String(neverIntent)}`);
    }
  }
}
