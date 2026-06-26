import { NextResponse } from "next/server";

import { getDesktopInstallInfo } from "@/lib/electron/desktop-install-info.server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const userAgent = request.headers.get("user-agent") ?? "";
  const info = await getDesktopInstallInfo(userAgent);
  return NextResponse.json(info, {
    headers: {
      "Cache-Control": "public, max-age=300",
    },
  });
}
