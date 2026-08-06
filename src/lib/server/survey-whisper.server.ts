import { normalizeLmstudioUrl } from "@/lib/lmstudio";
import { resolveServerProviderCredentials } from "@/lib/server/provider-credentials.server";

export type SurveyWhisperProvider = "openai" | "lmstudio" | "none";

export type SurveyWhisperStatus = {
  available: boolean;
  provider: SurveyWhisperProvider;
  model: string;
};

const DEFAULT_WHISPER_MODEL = "whisper-1";
const TRANSCRIBE_TIMEOUT_MS = 45_000;

function readWhisperModel(): string {
  return (process.env.SURVEY_WHISPER_MODEL || DEFAULT_WHISPER_MODEL).trim() || DEFAULT_WHISPER_MODEL;
}

function readLmstudioWhisperBaseUrl(): string {
  const explicit = (process.env.SURVEY_WHISPER_BASE_URL || "").trim();
  if (explicit) return normalizeLmstudioUrl(explicit);
  const lmstudio = (process.env.LMSTUDIO_URL || "").trim();
  if (lmstudio) return normalizeLmstudioUrl(lmstudio);
  return "";
}

export function getSurveyWhisperStatus(): SurveyWhisperStatus {
  const model = readWhisperModel();
  const { apiKey } = resolveServerProviderCredentials("openai", null);
  if (apiKey) {
    return { available: true, provider: "openai", model };
  }
  const lmstudioBase = readLmstudioWhisperBaseUrl();
  if (lmstudioBase) {
    return { available: true, provider: "lmstudio", model };
  }
  return { available: false, provider: "none", model };
}

/** ISO-639-1 from BCP-47 (en-US → en). */
export function normalizeWhisperLanguage(input: string | null | undefined): string | undefined {
  const value = (input ?? "").trim();
  if (!value || value === "auto") return undefined;
  const base = value.split("-")[0]?.toLowerCase();
  return base && /^[a-z]{2}$/.test(base) ? base : undefined;
}

export async function transcribeSurveyWhisperAudio(
  audio: Blob,
  options?: { language?: string | null },
): Promise<string> {
  const status = getSurveyWhisperStatus();
  if (!status.available) {
    throw new Error(
      "Whisper STT is not configured — set OPENAI_API_KEY on Vercel (or LMSTUDIO_URL for local dev).",
    );
  }

  const language = normalizeWhisperLanguage(options?.language);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TRANSCRIBE_TIMEOUT_MS);

  try {
    if (status.provider === "openai") {
      return await transcribeViaOpenAi(audio, status.model, language, controller.signal);
    }
    return await transcribeViaOpenAiCompatible(
      audio,
      `${readLmstudioWhisperBaseUrl()}/v1/audio/transcriptions`,
      status.model,
      language,
      controller.signal,
      readOpenAiKeyForLmstudio(),
    );
  } finally {
    clearTimeout(timeout);
  }
}

function readOpenAiKeyForLmstudio(): string {
  const { apiKey } = resolveServerProviderCredentials("openai", null);
  return apiKey;
}

async function transcribeViaOpenAi(
  audio: Blob,
  model: string,
  language: string | undefined,
  signal: AbortSignal,
): Promise<string> {
  const { apiKey } = resolveServerProviderCredentials("openai", null);
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for Whisper on Vercel.");
  }
  return transcribeViaOpenAiCompatible(
    audio,
    "https://api.openai.com/v1/audio/transcriptions",
    model,
    language,
    signal,
    apiKey,
  );
}

async function transcribeViaOpenAiCompatible(
  audio: Blob,
  url: string,
  model: string,
  language: string | undefined,
  signal: AbortSignal,
  apiKey: string,
): Promise<string> {
  const form = new FormData();
  form.append("file", audio, guessAudioFilename(audio.type));
  form.append("model", model);
  form.append("response_format", "json");
  if (language) form.append("language", language);

  const headers: Record<string, string> = {};
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: form,
    signal,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || response.statusText || `Whisper HTTP ${response.status}`);
  }

  try {
    const payload = JSON.parse(text) as { text?: string };
    return typeof payload.text === "string" ? payload.text.trim() : "";
  } catch {
    return text.trim();
  }
}

function guessAudioFilename(mimeType: string): string {
  if (mimeType.includes("webm")) return "chunk.webm";
  if (mimeType.includes("ogg")) return "chunk.ogg";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "chunk.m4a";
  if (mimeType.includes("wav")) return "chunk.wav";
  return "chunk.bin";
}
