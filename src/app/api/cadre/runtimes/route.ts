import { NextResponse } from "next/server";
import { cadreHostReadyMessage, getCadreRuntimeManager } from "@/lib/server/cadre-runtime-manager.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const manager = getCadreRuntimeManager();
  return NextResponse.json({
    ok: true,
    ready: cadreHostReadyMessage(),
    runtimes: manager.listRuntimes(),
    registry: manager.listRegistryEntries(),
  });
}
