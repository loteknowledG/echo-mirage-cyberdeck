import { NextRequest, NextResponse } from "next/server";

import { parseFoundationQuery } from "@/lib/muthur-foundation-intent";
import { buildFoundationResponse } from "@/lib/server/muthur-foundation-retrieval.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FoundationQueryBody = {
  message?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as FoundationQueryBody;
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) {
      return NextResponse.json(
        { handled: false, error: "message is required" },
        { status: 400 },
      );
    }

    const intent = parseFoundationQuery(message);
    if (!intent) {
      return NextResponse.json({ handled: false }, { headers: { "Cache-Control": "no-store" } });
    }

    const response = await buildFoundationResponse(intent);
    const foundationId = intent.kind === "origin_lineage" ? "foundation-001" : intent.id;

    return NextResponse.json(
      {
        handled: true,
        response,
        foundation_id: foundationId,
        read_only: true,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Foundation query failed";
    return NextResponse.json({ handled: false, error: message }, { status: 500 });
  }
}
