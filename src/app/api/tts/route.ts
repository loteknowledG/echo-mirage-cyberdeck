export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { EdgeTTS } from "edge-tts-universal";
import { NextRequest, NextResponse } from "next/server";
import { isMechanicusVoiceProfile } from "@/lib/cyberdeck/mechanicus-voice-profile";
import { resolveVoiceProfileEdgeConfig } from "@/lib/voice-profile-edge";
import { renderMechanicusVoice } from "@/server/render-mechanicus-voice";

const TTS_TIMEOUT_MS = 120_000;

async function renderVoiceProfile(profile: string, text: string) {
  const config = resolveVoiceProfileEdgeConfig(profile);
  const tts = new EdgeTTS(text, config.voice, {
    rate: config.rate,
    pitch: config.pitch,
    volume: config.volume,
  });

  const result = await Promise.race([
    tts.synthesize(),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("TTS synthesis timed out")), TTS_TIMEOUT_MS);
    }),
  ]);

  const audioBuffer = Buffer.from(await result.audio.arrayBuffer());
  if (!audioBuffer.length) {
    return { ok: false as const, error: "No audio returned" };
  }

  return {
    ok: true as const,
    audioBase64: audioBuffer.toString("base64"),
  };
}

async function renderMechanicusWithFallback(text: string) {
  const real = await renderMechanicusVoice(text);
  if (real.ok) {
    return {
      ok: true as const,
      provider: "coderobo+mechanicus" as const,
      audioBase64: real.audio.toString("base64"),
    };
  }

  const edge = await renderVoiceProfile("mechanicus-voice", text);
  if (!edge.ok) {
    return {
      ok: false as const,
      error: real.message || edge.error || "Mechanicus render failed",
    };
  }

  return {
    ok: true as const,
    provider: "edge-tts-fallback" as const,
    audioBase64: edge.audioBase64,
    fallbackReason: real.message,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const text = String(body?.text || "").trim();
    const profileRaw = String(body?.profile || body?.profileId || "jenny-neural").trim().toLowerCase();
    const voiceProfile = profileRaw === "jenny" ? "jenny-neural" : profileRaw || "jenny-neural";

    if (!text) return NextResponse.json({ error: "Missing text" }, { status: 400 });

    if (isMechanicusVoiceProfile(voiceProfile)) {
      const result = await renderMechanicusWithFallback(text);
      if (!result.ok) {
        return NextResponse.json(
          { ok: false, error: "VOICE_PROFILE_FAILED", detail: result.error || "Mechanicus render failed" },
          { status: 200 },
        );
      }

      return NextResponse.json({
        ok: true,
        provider: result.provider,
        profile: "mechanicus-voice",
        audioBase64: result.audioBase64,
        contentType: "audio/mpeg",
        ...(result.provider === "edge-tts-fallback" ? { fallbackReason: result.fallbackReason } : {}),
      });
    }

    const result = await renderVoiceProfile(voiceProfile, text);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: "VOICE_PROFILE_FAILED", detail: result.error || "No audio returned" },
        { status: 200 },
      );
    }

    return NextResponse.json({
      ok: true,
      provider: "edge-tts",
      profile: voiceProfile,
      audioBase64: result.audioBase64,
      contentType: "audio/mpeg",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[tts] failed", error);
    return NextResponse.json({ ok: false, error: "TTS_FAILED", detail: message }, { status: 200 });
  }
}
