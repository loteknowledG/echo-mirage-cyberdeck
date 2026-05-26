import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Dev pollers (wait-on, Electron, IDE preview) use HEAD — skip heavy route compiles. */
export function middleware(request: NextRequest) {
  if (request.method !== "HEAD") {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  if (pathname === "/" || pathname === "/cyberdeck") {
    return new NextResponse(null, { status: 200 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/cyberdeck"],
};
