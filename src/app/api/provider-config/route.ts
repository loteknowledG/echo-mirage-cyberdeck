import { NextResponse } from "next/server";
import { listServerConfiguredProviders } from "@/lib/server/provider-credentials.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Which gateway providers have server-side credentials (no secrets returned). */
export async function GET() {
  const configured = listServerConfiguredProviders();
  return NextResponse.json({
    configured,
    opencode: {
      zen: configured.opencodeZen,
      go: configured.opencodeGo,
    },
  });
}
