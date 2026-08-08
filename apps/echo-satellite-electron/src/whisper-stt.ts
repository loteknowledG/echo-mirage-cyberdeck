/**
 * Echo Satellite Whisper STT — mic chunks proxied through main process to Vercel.
 * Avoids unreliable Chromium Web Speech in Electron (especially on macOS).
 */

type SttReport = {
  interim?: string;
  final?: string;
  error?: string;
  listening?: boolean;
  level?: number;
  bands?: number[];
};

type WhisperSttApi = {
  getWhisperStatus: () => Promise<{
    ok: boolean;
    available?: boolean;
    provider?: string;
    model?: string;
    error?: string;
    relayBaseUrl?: string;
  }>;
  transcribeChunk: (input: {
    base64: string;
    mimeType?: string;
    lang?: string;
    fileName?: string;
  }) => Promise<{ ok: boolean; text?: string; reason?: string }>;
};

const WHISPER_CHUNK_MS = 5_000;
const MIN_CHUNK_BYTES = 900;

let whisperActive = false;
let whisperRecorder: MediaRecorder | null = null;
let whisperGeneration = 0;
let whisperTranscribeChain: Promise<void> = Promise.resolve();
let whisperChunkTimer: ReturnType<typeof setInterval> | null = null;

function getApi(): WhisperSttApi | undefined {
  return (window as unknown as { satellite?: WhisperSttApi }).satellite;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Could not read audio chunk."));
        return;
      }
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read audio chunk."));
    reader.readAsDataURL(blob);
  });
}

function pickRecorderMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate)) return candidate;
  }
  return "";
}

function enqueueWhisperChunk(
  blob: Blob,
  generation: number,
  lang: string,
  report: (payload: SttReport) => void,
  isActive: () => boolean,
) {
  if (blob.size < MIN_CHUNK_BYTES) return;
  whisperTranscribeChain = whisperTranscribeChain.then(async () => {
    if (!isActive() || generation !== whisperGeneration) return;
    report({ interim: "Whisper transcribing…", listening: true });
    try {
      const base64 = await blobToBase64(blob);
      const result = await getApi()?.transcribeChunk?.({
        base64,
        mimeType: blob.type || "audio/webm",
        lang,
        fileName: blob.type.includes("webm") ? "chunk.webm" : "chunk.bin",
      });
      if (!result?.ok) {
        throw new Error(result?.reason ?? "Whisper transcribe failed.");
      }
      if (!isActive() || generation !== whisperGeneration) {
        report({ interim: "" });
        return;
      }
      const text = result.text?.trim() ?? "";
      if (text) {
        report({ final: text, interim: "", listening: true, error: undefined });
      } else {
        report({ interim: "", listening: true });
      }
    } catch (error) {
      if (!isActive() || generation !== whisperGeneration) return;
      report({
        error: error instanceof Error ? error.message : String(error),
        interim: "",
      });
    }
  });
}

export async function fetchEchoWhisperAvailable(): Promise<boolean> {
  const status = await getApi()?.getWhisperStatus?.();
  return Boolean(status?.ok && status.available);
}

export function stopWhisperStt(): void {
  whisperActive = false;
  whisperGeneration += 1;
  if (whisperChunkTimer != null) {
    clearInterval(whisperChunkTimer);
    whisperChunkTimer = null;
  }
  const recorder = whisperRecorder;
  whisperRecorder = null;
  if (!recorder) return;
  try {
    if (recorder.state !== "inactive") recorder.stop();
  } catch {
    /* ignore */
  }
}

export function startWhisperStt(
  stream: MediaStream,
  lang: string,
  report: (payload: SttReport) => void,
  isActive: () => boolean,
): boolean {
  stopWhisperStt();
  if (typeof MediaRecorder === "undefined") {
    report({ error: "MediaRecorder unavailable for Whisper STT." });
    return false;
  }

  const mimeType = pickRecorderMimeType();
  whisperActive = true;
  const generation = whisperGeneration;

  try {
    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 64_000 })
      : new MediaRecorder(stream);
    whisperRecorder = recorder;

    recorder.ondataavailable = (event) => {
      if (!event.data || event.data.size === 0) return;
      enqueueWhisperChunk(event.data, generation, lang, report, isActive);
    };

    recorder.onerror = () => {
      if (!isActive() || generation !== whisperGeneration) return;
      report({ error: "Whisper recorder error — retry Start Listening." });
    };

    recorder.start(WHISPER_CHUNK_MS);
    whisperChunkTimer = setInterval(() => {
      if (!isActive() || generation !== whisperGeneration || recorder.state !== "recording") return;
      try {
        recorder.requestData();
      } catch {
        /* ignore */
      }
    }, WHISPER_CHUNK_MS);

    report({
      listening: true,
      interim: "Whisper listening…",
      error: undefined,
    });
    return true;
  } catch (error) {
    stopWhisperStt();
    report({
      listening: false,
      error: error instanceof Error ? error.message : "Could not start Whisper recorder.",
    });
    return false;
  }
}
