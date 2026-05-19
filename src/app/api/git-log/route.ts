import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { execSync } = require("child_process");
    const log = execSync("git log --oneline -20", { encoding: "utf-8" } as any);
    return NextResponse.json({ log: log.slice(0, 3000) });
  } catch (e) {
    return NextResponse.json({ log: "" });
  }
}