import { NextRequest, NextResponse } from "next/server";

import { parseAionQuery } from "@/lib/muthur-aion-intent";
import { buildAionResponse } from "@/lib/server/muthur-aion-retrieval.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AionQueryBody = {
  message?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AionQueryBody;
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) {
      return NextResponse.json({ handled: false, error: "message is required" }, { status: 400 });
    }

    const intent = parseAionQuery(message);
    if (!intent) {
      return NextResponse.json({ handled: false }, { headers: { "Cache-Control": "no-store" } });
    }

    const response = await buildAionResponse(intent);

    return NextResponse.json(
      {
        handled: true,
        response,
        pack_id: "aion",
        read_only: true,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Aion query failed";
    return NextResponse.json({ handled: false, error: message }, { status: 500 });
  }
}
