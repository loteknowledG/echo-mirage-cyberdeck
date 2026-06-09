import { promises as fs } from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { validateReadFilePath } from "@/lib/muthur/execution/safety-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const filePath = url.searchParams.get("path");
    if (!filePath) {
      return NextResponse.json({ error: "No path provided" }, { status: 400 });
    }
    const validated = validateReadFilePath(filePath);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.reason }, { status: 403 });
    }
    const content = await fs.readFile(validated.abs, "utf8");
    return NextResponse.json({ content: content.slice(0, 50000) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}