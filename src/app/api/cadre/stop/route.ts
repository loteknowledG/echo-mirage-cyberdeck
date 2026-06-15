import { NextRequest, NextResponse } from "next/server";
import { getCadreRuntimeManager } from "@/lib/server/cadre-runtime-manager.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { runtimeId?: unknown };
  const runtimeId = typeof body.runtimeId === "string" ? body.runtimeId.trim() : "";
  if (!runtimeId) {
    return NextResponse.json({ ok: false, error: "runtimeId is required" }, { status: 400 });
  }

  const manager = getCadreRuntimeManager();
  const stopped = await manager.stopRuntime(runtimeId);
  if (!stopped) {
    return NextResponse.json({ ok: false, error: `Unknown runtime: ${runtimeId}` }, { status: 404 });
  }

  return NextResponse.json({ ok: true, runtime: stopped });
}
