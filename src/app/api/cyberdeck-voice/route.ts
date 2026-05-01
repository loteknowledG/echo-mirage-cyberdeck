import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { renderCoderoboNewTts } from "@/server/coderoboNewTts";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const requestId = randomUUID();
    const body = await request.json();
    const text = (body?.text || "").toString().trim();

    console.info("[muthur] request", {
      requestId,
      textLength: text.length,
      text,
    });

    const result = await renderCoderoboNewTts({
      text,
      language: "en-US",
      voiceType: "JennyNeural",
      gender: "Female",
      ratePercent: -14,
      pitchHz: -1,
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
