import { NextRequest, NextResponse } from "next/server";

import {
  patchVscodeVoiceBridgeState,
  readVscodeVoiceBridgeState,
} from "@/server/cyberdeck-bridges/vscode-voice.server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(readVscodeVoiceBridgeState());
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      muted?: boolean;
      profile?: string;
      speak?: string;
    };
    const state = await patchVscodeVoiceBridgeState(body);
    return NextResponse.json({ ok: true, ...state });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: String((error as Error)?.message || error) },
      { status: 400 },
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
