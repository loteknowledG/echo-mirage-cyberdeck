import { NextResponse } from "next/server";
import { WORKSPACE_ROOT } from "@/lib/muthur/execution/safety-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ root: WORKSPACE_ROOT });
}
