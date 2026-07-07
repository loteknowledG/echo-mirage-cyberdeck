/** Inline markers streamed around each provider reasoning delta (stripped from MUTHUR channel body). */
export const MUTHUR_REASONING_OPEN = "⟦R⟧";
export const MUTHUR_REASONING_CLOSE = "⟦/R⟧";

const MUTHUR_REASONING_BLOCK_RE = /⟦R⟧([\s\S]*?)⟦\/R⟧/g;

/** @deprecated Use MUTHUR_REASONING_OPEN */
export const MUTHUR_REASONING_STREAM_SENTINEL = MUTHUR_REASONING_OPEN;

export function appendMuthurReasoningStreamDelta(reasoning: string): string {
  const chunk = reasoning.trim();
  if (!chunk) return "";
  return `${MUTHUR_REASONING_OPEN}${chunk}${MUTHUR_REASONING_CLOSE}`;
}

/** Split live/completed uplink text into operator-visible body and model reasoning tokens. */
export function extractMuthurStreamReasoning(text: string): { body: string; reasoning: string } {
  if (!text.includes(MUTHUR_REASONING_OPEN)) {
    return { body: text, reasoning: "" };
  }

  const reasoningParts: string[] = [];
  let body = text.replace(MUTHUR_REASONING_BLOCK_RE, (_match, chunk: string) => {
    if (chunk) reasoningParts.push(chunk);
    return "";
  });

  return { body, reasoning: reasoningParts.join("") };
}

export function formatMuthurReasoningDiagnostic(reasoning: string): string {
  const trimmed = reasoning.trim();
  if (!trimmed) return "";
  return `[REASONING] ${trimmed}`;
}
