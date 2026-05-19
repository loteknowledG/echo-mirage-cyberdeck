import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_COMMANDS = [
  "pnpm exec tsc --noEmit",
  "pnpm build",
  "pnpm e2e",
  "git diff",
  "git status --short",
  "git log --oneline -10",
];

export async function POST(req: NextRequest) {
  try {
    const { command } = await req.json();
    
    if (!command) {
      return NextResponse.json({ error: "No command provided" }, { status: 400 });
    }

    if (!ALLOWED_COMMANDS.includes(command)) {
      return NextResponse.json({ 
        error: "Command not allowlisted", 
        requested: command,
        allowed: ALLOWED_COMMANDS 
      }, { status: 403 });
    }

    const { execSync } = require("child_process");
    const startTime = Date.now();
    let stdout = "";
    let stderr = "";
    let exitCode = 0;

    try {
      stdout = execSync(command, { encoding: "utf-8", timeout: 60000 });
    } catch (e: any) {
      exitCode = e.status || 1;
      stderr = e.message || "";
    }
    
    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      exitCode,
      stdout: stdout.slice(0, 5000),
      stderr: stderr.slice(0, 2000),
      durationMs,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}