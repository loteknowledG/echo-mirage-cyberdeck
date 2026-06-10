import type { PmCallTurn } from "@/lib/pm-call-center/types";

export type TranscriptJsonMessage = {
  speaker: "resident" | "operator" | "system";
  timestamp: string;
  text: string;
  notes?: string;
};

export type TranscriptJson = {
  callId: string;
  caseId: string;
  startedAt: string;
  endedAt: string;
  messages: TranscriptJsonMessage[];
};

function speakerLabel(role: PmCallTurn["role"]): TranscriptJsonMessage["speaker"] {
  return role;
}

function formatClock(ms: number): string {
  const d = new Date(ms);
  return d.toISOString();
}

export function buildTranscriptJson(params: {
  callId: string;
  caseId: string;
  startedAt: number;
  endedAt: number;
  turns: PmCallTurn[];
}): TranscriptJson {
  return {
    callId: params.callId,
    caseId: params.caseId,
    startedAt: formatClock(params.startedAt),
    endedAt: formatClock(params.endedAt),
    messages: params.turns.map((turn) => ({
      speaker: speakerLabel(turn.role),
      timestamp: formatClock(turn.at),
      text: turn.text,
      ...(turn.notes?.trim() ? { notes: turn.notes.trim() } : {}),
    })),
  };
}

export function buildTranscriptMarkdown(params: {
  callId: string;
  caseId: string;
  turns: PmCallTurn[];
}): string {
  const lines = [
    "# Call Transcript",
    "",
    `Call ID: ${params.callId}`,
    `Case ID: ${params.caseId}`,
    "",
  ];

  for (const turn of params.turns) {
    const label =
      turn.role === "resident"
        ? "RESIDENT"
        : turn.role === "operator"
          ? "OPERATOR"
          : "SYSTEM";
    lines.push(`${label}:`);
    lines.push(turn.text.trim());
    if (turn.role === "operator" && turn.notes?.trim()) {
      lines.push("");
      lines.push(`OPERATOR_THINKING: ${turn.notes.trim()}`);
    }
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}
