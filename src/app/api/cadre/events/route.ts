import { NextResponse } from "next/server";

import { listCadreEvents } from "@/lib/server/cadre-event-log.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limitRaw = Number.parseInt(url.searchParams.get("limit") ?? "100", 10);
  const limit = Number.isFinite(limitRaw) ? limitRaw : 100;

  return NextResponse.json(
    { ok: true, events: listCadreEvents(limit) },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
