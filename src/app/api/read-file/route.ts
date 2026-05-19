import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const filePath = url.searchParams.get("path");
    if (!filePath) {
      return NextResponse.json({ error: "No path provided" }, { status: 400 });
    }
    const fs = require("fs");
    const content = fs.readFileSync(filePath, "utf-8");
    return NextResponse.json({ content: content.slice(0, 50000) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}