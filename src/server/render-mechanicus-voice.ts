import { renderCoderoboNewTts } from "@/server/coderoboNewTts";
import {
  applyFfmpegVoiceEffect,
  MECHANICUS_FFMPEG_FILTER,
} from "@/server/voice-effects/apply-ffmpeg-voice-effect";

export type MechanicusRenderResult =
  | { ok: true; audio: Buffer }
  | { ok: false; stage: string; message: string; details: string };

/** Real Tech Priest: Coderobo AndrewNeural + Samus mechanicus ffmpeg chain. */
export async function renderMechanicusVoice(text: string): Promise<MechanicusRenderResult> {
  const synthesized = await renderCoderoboNewTts({
    text,
    language: "en-US",
    voiceType: "AndrewNeural",
    gender: "Male",
    ratePercent: -24,
    pitchHz: -10,
  });

  if (!synthesized.ok) {
    return synthesized;
  }

  const processed = await applyFfmpegVoiceEffect(synthesized.audio, MECHANICUS_FFMPEG_FILTER);
  if (!processed?.length) {
    return {
      ok: false,
      stage: "mechanicus_fx",
      message: "ffmpeg mechanicus effect unavailable (install ffmpeg and ensure it is on PATH)",
      details: "",
    };
  }

  return { ok: true, audio: processed };
}
