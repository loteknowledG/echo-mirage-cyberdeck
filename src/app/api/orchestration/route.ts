import { NextResponse } from "next/server";
import { loadOrchestrationBundle } from "@/lib/orchestration/load-orchestration.server";

export async function GET() {
  const bundle = await loadOrchestrationBundle();
  return NextResponse.json(bundle);
}