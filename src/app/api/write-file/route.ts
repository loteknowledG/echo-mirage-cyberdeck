import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { validateWriteFilePath } from "@/lib/muthur/execution/safety-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { path?: string; content?: unknown };
    const filePath = typeof body.path === "string" ? body.path.trim() : "";
    if (!filePath) {
      return NextResponse.json({ ok: false, error: "No path provided" }, { status: 400 });
    }
    if (!("content" in body)) {
      return NextResponse.json({ ok: false, error: 'Missing "content" field' }, { status: 400 });
    }
    if (typeof body.content !== "string") {
      return NextResponse.json({ ok: false, error: '"content" must be a string' }, { status: 400 });
    }

    const validated = validateWriteFilePath(filePath);
    if (!validated.ok) {
      return NextResponse.json({ ok: false, error: validated.reason }, { status: 403 });
    }

    await mkdir(path.dirname(validated.abs), { recursive: true });
    await writeFile(validated.abs, body.content, "utf8");

    return NextResponse.json({ ok: true, path: validated.abs });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Write failed" },
      { status: 500 },
    );
  }
}
