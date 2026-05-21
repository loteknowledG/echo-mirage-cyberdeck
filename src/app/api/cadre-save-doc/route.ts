import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isSafeCadreRelativePath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized.startsWith("docs/cadre/")) return false;
  if (normalized.includes("..")) return false;
  return /^docs\/cadre\/[\w./-]+\.md$/i.test(normalized);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { relativePath?: string; content?: string };
    const relativePath = String(body.relativePath || "").trim();
    const content = String(body.content ?? "");

    if (!relativePath || !content.trim()) {
      return NextResponse.json({ error: "relativePath and content required" }, { status: 400 });
    }

    if (!isSafeCadreRelativePath(relativePath)) {
      return NextResponse.json({ error: "Invalid Cadre path" }, { status: 400 });
    }

    const root = process.cwd();
    const absolutePath = path.join(root, ...relativePath.split("/"));
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content, "utf8");

    return NextResponse.json({ ok: true, path: relativePath });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Save failed" },
      { status: 500 },
    );
  }
}
