import type { MuthurChatMessage } from "@/lib/muthur-core/muthur-command-console";

/** Explicit MUTHUR response lifecycle (L-UI-001 D4). */
export type MuthurResponseLifecycle =
  | "idle"
  | "composing"
  | "complete"
  | "failed"
  | "stalled";

const CHANNEL_ROLES = new Set(["user", "assistant"]);

/** Only MUTHUR operator + assistant rows belong in the response channel (D10). */
export function isMuthurResponseChannelRole(role: string): boolean {
  return CHANNEL_ROLES.has(role);
}

export function isMuthurDiagnosticRole(role: string): boolean {
  return !isMuthurResponseChannelRole(role);
}

export type MuthurChannelPartitionResult = {
  channel: MuthurChatMessage[];
  newDiagnostics: string[];
};

/**
 * Split a chat update into response channel vs diagnostic lines.
 * System/error rows never remain in the channel.
 */
export function partitionMuthurChannelUpdate(
  prev: MuthurChatMessage[],
  rawNext: MuthurChatMessage[],
): MuthurChannelPartitionResult {
  const newDiagnostics: string[] = [];
  const channel: MuthurChatMessage[] = [];

  for (let i = 0; i < rawNext.length; i += 1) {
    const message = rawNext[i];
    if (isMuthurDiagnosticRole(message.role)) {
      const prior = prev[i];
      if (!prior || prior.role !== message.role || prior.text !== message.text) {
        newDiagnostics.push(message.text);
      }
      continue;
    }
    if (!isMuthurResponseChannelRole(message.role)) {
      newDiagnostics.push(`[REJECTED_CHANNEL_WRITE] ${message.role}: ${message.text.slice(0, 120)}`);
      continue;
    }
    channel.push(message);
  }

  return { channel, newDiagnostics };
}

export function resolveMuthurResponseLifecycle(args: {
  isStreaming: boolean;
  streamText: string;
  messages: MuthurChatMessage[];
  failed?: boolean;
  stalled?: boolean;
}): MuthurResponseLifecycle {
  if (args.stalled) return "stalled";
  if (args.failed) return "failed";
  if (args.isStreaming || args.streamText.trim()) return "composing";
  const lastUserIndex = args.messages.findLastIndex((message) => message.role === "user");
  const hasAssistantAfterLastUser =
    lastUserIndex >= 0 &&
    args.messages.slice(lastUserIndex + 1).some((message) => message.role === "assistant");
  if (hasAssistantAfterLastUser) return "complete";
  return "idle";
}

export function lifecycleFooterLabel(phase: MuthurResponseLifecycle): string {
  switch (phase) {
    case "composing":
      return "· MUTHUR composing…";
    case "complete":
      return "· MUTHUR complete";
    case "failed":
      return "· MUTHUR failed";
    case "stalled":
      return "· MUTHUR response stalled";
    default:
      return "";
  }
}

export function buildStalledOperatorMessage(phase: string, elapsedMs: number): string {
  const cleanPhase = phase.trim().replace(/^⏳\s*/, "") || "MUTHUR uplink active";
  const seconds = Math.max(1, Math.round(elapsedMs / 1000));
  return `MUTHUR response stalled. Last phase: ${cleanPhase} (${seconds}s). Diagnostics available.`;
}
