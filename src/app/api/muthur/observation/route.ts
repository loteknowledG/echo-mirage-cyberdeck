import { NextResponse } from "next/server";
import {
  getLatestMuthurObservation,
  recordMuthurObservation,
} from "@/lib/muthur/observation/observation-store.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestedSurface = new URL(request.url).searchParams.get("surface");
  const surface =
    requestedSurface === "property-manager" || requestedSurface === "cyberdeck"
      ? requestedSurface
      : undefined;
  return NextResponse.json(
    { ok: true, observation: getLatestMuthurObservation(surface) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { snapshot?: unknown };
    return NextResponse.json({ ok: true, observation: recordMuthurObservation(body.snapshot) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid observation snapshot." },
      { status: 400 },
    );
  }
}
