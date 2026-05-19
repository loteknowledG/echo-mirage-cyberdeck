import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { execSync } = require("child_process");
    const diff = execSync("git diff --no-color -100", { 
      encoding: "utf-8",
    } as any);
    return NextResponse.json({ diff: diff.slice(0, 8000) });
  } catch (e) {
    const diff = (e as Error).message || "";
    return NextResponse.json({ diff: diff.includes("not a git repository") ? "" : diff.slice(0, 1000) });
  }
}