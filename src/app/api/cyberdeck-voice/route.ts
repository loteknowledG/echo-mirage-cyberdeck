import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { renderCoderoboNewTts } from "@/server/coderoboNewTts";
import { MUTHUR_PRESET } from "@/voice/muthurPreset";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const requestId = randomUUID();
    const body = await request.json();
    const text = (body?.text || "").toString().trim();
    const voiceTuning = body?.voiceTuning && typeof body.voiceTuning === "object"
      ? (body.voiceTuning as Record<string, unknown>)
      : {};
    const ratePercent =
      typeof voiceTuning.ratePercent === "number"
        ? voiceTuning.ratePercent
        : MUTHUR_PRESET.backend.ratePercent;
    const pitchHz =
      typeof voiceTuning.pitchHz === "number"
        ? voiceTuning.pitchHz
        : MUTHUR_PRESET.backend.pitchHz;

    console.info("[muthur] request", {
      requestId,
      textLength: text.length,
      text,
      voiceTuning: {
        ratePercent,
        pitchHz,
        volume: typeof voiceTuning.volume === "number" ? voiceTuning.volume : null,
      },
    });

    const result = await renderCoderoboNewTts({
      text,
      ...MUTHUR_PRESET.backend,
      ratePercent,
      pitchHz,
    });

    if (result.ok) {
      return new Response(new Uint8Array(result.audio), {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "no-store",
        },
      });
    }

    console.warn("[muthur] coderobo diagnostic", {
      requestId,
      stage: result.stage,
      message: result.message,
      details: result.details,
    });

    return NextResponse.json({
      ok: false,
      stage: result.stage,
      message: result.message,
      details: result.details,
    });
  } catch (error) {
    console.error("[muthur] request handler failed", error);
    return NextResponse.json(
      {
        ok: false,
        stage: "request_handler",
        message: error instanceof Error ? error.message : "Voice synthesis failed",
        details: error instanceof Error ? error.stack || "" : "",
      },
      { status: 500 },
    );
  }
}
