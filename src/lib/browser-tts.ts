/** Same-origin proxy to coderobo browser TTS (Voice Studio preview cards). */
const DEFAULT_TTS_BASE_URL = "https://aivoice.coderobo.org";

export function canUseRemoteTts(): boolean {
  return typeof fetch === "function";
}

export async function requestRemoteTtsAudioUrl({
  text,
  voice,
  rate = 0,
  pitch = 0,
  baseUrl = "",
}: {
  text: string;
  voice: string;
  rate?: number;
  pitch?: number;
  baseUrl?: string;
}): Promise<string> {
  const cleanedText = String(text || "").trim();
  if (!cleanedText) {
    throw new Error("Text is required");
  }

  const cleanedVoice = String(voice || "").trim();
  if (!cleanedVoice) {
    throw new Error("Voice is required");
  }

  const normalizedBase = String(baseUrl || "").replace(/\/+$/, "");
  const postPath = normalizedBase ? `${normalizedBase}/api/tts` : "/api/browser-tts";
  const response = await fetch(postPath, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: cleanedText,
      voice: cleanedVoice,
      rate,
      pitch,
    }),
  });

  const responseBody = await response.text();
  let json: { audio_url?: string; audio_path?: string; error?: string } = {};
  try {
    json = responseBody ? JSON.parse(responseBody) : {};
  } catch (error) {
    throw new Error(`Invalid TTS response: ${String((error as Error)?.message || error)}`);
  }

  if (!response.ok) {
    throw new Error(json?.error || `TTS request failed: HTTP ${response.status}`);
  }

  const audioPath = String(json?.audio_url || json?.audio_path || "").trim();
  if (!audioPath) {
    throw new Error("TTS response did not include an audio URL");
  }

  const resolveBase =
    normalizedBase ||
    (typeof window !== "undefined" ? window.location.origin : DEFAULT_TTS_BASE_URL);
  return new URL(audioPath, `${resolveBase.replace(/\/+$/, "")}/`).toString();
}
