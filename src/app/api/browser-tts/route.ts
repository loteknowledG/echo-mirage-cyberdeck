import { NextRequest, NextResponse } from "next/server";

const CODEROBO_TTS_URL = "https://aivoice.coderobo.org/api/tts";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const text = String(body?.text || "").trim();
    const voice = String(body?.voice || "").trim();
    const rate = Number(body?.rate ?? 0);
    const pitch = Number(body?.pitch ?? 0);

    if (!text) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }
    if (!voice) {
      return NextResponse.json({ error: "Missing voice" }, { status: 400 });
    }

    const upstream = await fetch(CODEROBO_TTS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice, rate, pitch }),
    });

    const payload = await upstream.text();
    let json: Record<string, unknown> = {};
    try {
      json = payload ? JSON.parse(payload) : {};
    } catch {
      return NextResponse.json({ error: "Invalid upstream TTS response" }, { status: 502 });
    }

    if (!upstream.ok) {
      return NextResponse.json(
        { error: String(json.error || `Upstream TTS failed: HTTP ${upstream.status}`) },
        { status: upstream.status },
      );
    }

    return NextResponse.json(json);
  } catch (error) {
    console.error("[browser-tts] failed", error);
    return NextResponse.json(
      { error: (error as Error).message || "Unknown error" },
      { status: 500 },
    );
  }
}
