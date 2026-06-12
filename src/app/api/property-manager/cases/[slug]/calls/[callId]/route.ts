import { NextResponse } from "next/server";
import { loadCaseCallDetail } from "@/lib/property-manager/cases/reader.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ slug: string; callId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, callId } = await context.params;
    const detail = await loadCaseCallDetail(
      decodeURIComponent(slug),
      decodeURIComponent(callId),
    );
    if (!detail) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (error) {
    console.error("[api/property-manager/cases/[slug]/calls/[callId]][error]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load call" },
      { status: 500 },
    );
  }
}
