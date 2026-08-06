import type { NextRequest } from "next/server";
import {
  getSurveyWhisperStatus,
  transcribeSurveyWhisperAudio,
} from "@/lib/server/survey-whisper.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

type TranscribePayload = {
  ok: boolean;
  text?: string;
  provider?: string;
  model?: string;
  error?: string;
};

export async function GET() {
  const status = getSurveyWhisperStatus();
  const payload: TranscribePayload = {
    ok: true,
    provider: status.provider,
    model: status.model,
    error: status.available
      ? undefined
      : "Set OPENAI_API_KEY on Vercel for Whisper STT (local: LMSTUDIO_URL optional).",
  };
  return Response.json(
    { ...payload, available: status.available },
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

export async function POST(req: NextRequest) {
  const status = getSurveyWhisperStatus();
  if (!status.available) {
    const payload: TranscribePayload = {
      ok: false,
      error:
        "Whisper STT unavailable — add OPENAI_API_KEY to Vercel env for https://echo-mirage-cyberdeck.vercel.app.",
    };
    return Response.json(payload, { status: 503 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ ok: false, error: "Expected multipart audio upload." }, { status: 400 });
  }

  const audioEntry = form.get("audio");
  if (!(audioEntry instanceof Blob) || audioEntry.size === 0) {
    return Response.json({ ok: false, error: "Missing audio blob." }, { status: 400 });
  }
  if (audioEntry.size > MAX_AUDIO_BYTES) {
    return Response.json(
      { ok: false, error: `Audio chunk too large (max ${MAX_AUDIO_BYTES} bytes).` },
      { status: 413 },
    );
  }

  const langParam = form.get("lang");
  const language = typeof langParam === "string" ? langParam : undefined;

  try {
    const text = await transcribeSurveyWhisperAudio(audioEntry, { language });
    const payload: TranscribePayload = {
      ok: true,
      text,
      provider: status.provider,
      model: status.model,
    };
    return Response.json(payload, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 502 });
  }
}
