import { NextResponse } from "next/server";

import { getDesktopShellStatus } from "@/lib/server/desktop-shell-status.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Local probe — PWA/browser checks whether the desktop cyberdeck server is running. */
export async function GET() {
  return NextResponse.json(getDesktopShellStatus(), {
    headers: { "Cache-Control": "no-store" },
  });
}
