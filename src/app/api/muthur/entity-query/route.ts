import { NextRequest, NextResponse } from "next/server";

import { parseEntityAtlasQuery } from "@/lib/entity-atlas/entity-atlas-query";
import { buildEntityAtlasResponse } from "@/lib/entity-atlas/entity-atlas-retrieval.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EntityQueryBody = {
  message?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as EntityQueryBody;
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) {
      return NextResponse.json(
        { handled: false, error: "message is required" },
        { status: 400 },
      );
    }

    const intent = parseEntityAtlasQuery(message);
    if (!intent) {
      return NextResponse.json({ handled: false }, { headers: { "Cache-Control": "no-store" } });
    }

    const retrieval = buildEntityAtlasResponse(intent);

    return NextResponse.json(
      {
        handled: true,
        entity_type: retrieval.entity_type,
        response: retrieval.response,
        result: retrieval.result,
        read_only: true,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : "Entity query failed";
    return NextResponse.json({ handled: false, error: errMessage }, { status: 500 });
  }
}
