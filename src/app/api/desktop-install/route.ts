import { NextResponse } from "next/server";

import {
  getDesktopInstallInfo,
  parseDesktopInstallPlatformParam,
} from "@/lib/electron/desktop-install-info.server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const userAgent = request.headers.get("user-agent") ?? "";
  const platformParam = new URL(request.url).searchParams.get("platform");
  const platformOverride = parseDesktopInstallPlatformParam(platformParam);
  const info = await getDesktopInstallInfo(userAgent, platformOverride);
  return NextResponse.json(info, {
    headers: {
      // Response varies by client OS — never serve a cached Windows payload to macOS (etc.).
      "Cache-Control": "private, no-store",
      Vary: "User-Agent",
    },
  });
}
