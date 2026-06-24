import { NextResponse } from "next/server";
import { getCalyxStatus } from "@/lib/calyx/calyx-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const status = await getCalyxStatus();
  return NextResponse.json({ ok: status.status === "READY", ...status });
}
