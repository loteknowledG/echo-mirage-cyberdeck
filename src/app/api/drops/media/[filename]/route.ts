import { NextResponse } from "next/server";
import { readDropImage } from "@/lib/dropbay/dropbay-media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ filename: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { filename } = await context.params;
  const decoded = decodeURIComponent(filename);
  const file = await readDropImage(decoded);
  if (!file) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(file.bytes), {
    status: 200,
    headers: {
      "Content-Type": file.mimeType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
