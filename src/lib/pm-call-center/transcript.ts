import type { PmCallTurn } from "@/lib/pm-call-center/types";

export function formatPmCallTranscript(turns: PmCallTurn[]): string {
  return turns
    .map((turn) => {
      const label =
        turn.role === "resident"
          ? "RESIDENT"
          : turn.role === "operator"
            ? "OPERATOR"
            : "SYSTEM";
      const lines = [`${label}: ${turn.text.trim()}`];
      if (turn.role === "operator" && turn.notes?.trim()) {
        lines.push(`OPERATOR_THINKING: ${turn.notes.trim()}`);
      }
      return lines.join("\n");
    })
    .filter((block) => block.length > "RESIDENT: ".length)
    .join("\n\n");
}

export function createPmCallTurn(
  role: PmCallTurn["role"],
  text: string,
  notes?: string,
): PmCallTurn {
  const trimmedNotes = notes?.trim();
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    text: text.trim(),
    ...(trimmedNotes ? { notes: trimmedNotes } : {}),
    at: Date.now(),
  };
}
