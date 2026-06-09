import type { MuthurVoiceDialState } from "@/voice/muthurVoiceSettings";

export type CyberdeckVoiceTuning = MuthurVoiceDialState & {
  voiceType?: string;
  gender?: "Male" | "Female";
};

export const CODEROBO_MIN_TTS_CHARS = 10;

/** Coderobo rejects payloads shorter than 10 characters. */
export function ensureTtsTextLength(text: string, minLength = CODEROBO_MIN_TTS_CHARS): string {
  const trimmed = text.trim();
  if (trimmed.length >= minLength) return trimmed;
  if (!trimmed) return trimmed;
  return trimmed.padEnd(minLength, ".");
}
