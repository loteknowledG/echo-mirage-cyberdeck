import { NextRequest, NextResponse } from "next/server";
import { isCadreTerminalType } from "@/lib/cadre/runtime-registry";
import { getCadreRuntimeManager } from "@/lib/server/cadre-runtime-manager.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { runtime?: unknown };
  if (!isCadreTerminalType(body.runtime)) {
    return NextResponse.json(
      { ok: false, error: "runtime must be one of: codex, cursor, opencode, pi" },
      { status: 400 },
    );
  }

  const manager = getCadreRuntimeManager();
  const started = await manager.startRuntime(body.runtime);
  return NextResponse.json({ ok: true, runtime: started });
}
