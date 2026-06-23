import { NextResponse } from "next/server";
import { getPiComputerUseStatus } from "@/lib/pi/pi-computer-use-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getPiComputerUseStatus());
}
