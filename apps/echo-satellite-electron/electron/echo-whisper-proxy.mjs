import { Blob } from "node:buffer";
import { getSurveyRelayBaseUrl } from "./survey-relay-client.mjs";

function normalizeLang(raw) {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (!trimmed) return "en";
  return trimmed.split("-")[0]?.toLowerCase() || "en";
}

/**
 * @returns {Promise<{ ok: boolean, available?: boolean, provider?: string, model?: string, error?: string, relayBaseUrl?: string }>}
 */
export async function fetchEchoWhisperStatus() {
  const relayBaseUrl = getSurveyRelayBaseUrl();
  const url = `${relayBaseUrl}/api/survey/transcribe`;
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
    const payload = await res.json();
    return {
      ok: true,
      available: Boolean(payload.available),
      provider: typeof payload.provider === "string" ? payload.provider : undefined,
      model: typeof payload.model === "string" ? payload.model : undefined,
      error: typeof payload.error === "string" ? payload.error : undefined,
      relayBaseUrl,
    };
  } catch (error) {
    return {
      ok: false,
      available: false,
      relayBaseUrl,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Forward mic chunk to Mirage/Vercel Whisper API (Electron Chromium speech is unreliable).
 * @param {{ base64: string, mimeType?: string, lang?: string, fileName?: string }} input
 */
export async function transcribeEchoWhisperChunk(input) {
  const base64 = typeof input.base64 === "string" ? input.base64.trim() : "";
  if (!base64) {
    return { ok: false, reason: "Missing audio chunk." };
  }

  const relayBaseUrl = getSurveyRelayBaseUrl();
  const url = `${relayBaseUrl}/api/survey/transcribe`;
  const mimeType = input.mimeType?.trim() || "audio/webm";
  const fileName = input.fileName?.trim() || (mimeType.includes("webm") ? "chunk.webm" : "chunk.bin");
  const lang = normalizeLang(input.lang);

  try {
    const buffer = Buffer.from(base64, "base64");
    if (buffer.length === 0) {
      return { ok: false, reason: "Empty audio chunk." };
    }

    const form = new FormData();
    form.append("audio", new Blob([buffer], { type: mimeType }), fileName);
    form.append("lang", lang);

    const res = await fetch(url, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(45_000),
    });
    const payload = await res.json();
    if (!res.ok || !payload.ok) {
      return {
        ok: false,
        reason: payload.error ?? `Whisper HTTP ${res.status}`,
      };
    }
    return {
      ok: true,
      text: typeof payload.text === "string" ? payload.text.trim() : "",
      provider: payload.provider,
      model: payload.model,
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}
