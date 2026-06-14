import { NextRequest, NextResponse } from "next/server";

import { parseMemoryAtlasQuery } from "@/lib/memory-atlas/memory-atlas-query";
import { buildMemoryAtlasResponse } from "@/lib/memory-atlas/memory-atlas-retrieval.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MemoryQueryBody = {
  message?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as MemoryQueryBody;
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) {
      return NextResponse.json(
        { handled: false, error: "message is required" },
        { status: 400 },
      );
    }

    const intent = parseMemoryAtlasQuery(message);
    if (!intent) {
      return NextResponse.json({ handled: false }, { headers: { "Cache-Control": "no-store" } });
    }

    const retrieval = buildMemoryAtlasResponse(intent);

    return NextResponse.json(
      {
        handled: true,
        memory_type: retrieval.memory_type,
        response: retrieval.response,
        result: retrieval.result,
        read_only: true,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : "Memory query failed";
    return NextResponse.json({ handled: false, error: errMessage }, { status: 500 });
  }
}
