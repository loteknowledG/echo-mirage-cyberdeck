import { NextResponse } from "next/server";

import { parseDesktopInstallPlatformParam } from "@/lib/electron/desktop-install-info.server";
import { getSatelliteInstallInfo } from "@/lib/electron/satellite-install-info.server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const userAgent = request.headers.get("user-agent") ?? "";
  const platformParam = new URL(request.url).searchParams.get("platform");
  const platformOverride = parseDesktopInstallPlatformParam(platformParam);
  const info = await getSatelliteInstallInfo(userAgent, platformOverride);
  return NextResponse.json(info, {
    headers: {
      "Cache-Control": "private, no-store",
      Vary: "User-Agent",
    },
  });
}
