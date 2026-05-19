import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { command, args } = await req.json();
    
    if (!command) {
      return NextResponse.json({ error: "No command provided" }, { status: 400 });
    }

    // Supported commands that Muthur can send to opencode
    const results: Record<string, any> = {};
    
    // Read file command
    if (command === "read") {
      const fs = require("fs");
      const path = require("path");
      const filePath = args?.path || "";
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        results.content = content.slice(0, 50000);
        results.success = true;
      } catch (e) {
        results.error = (e as Error).message;
        results.success = false;
      }
    }
    
    // Git diff command
    else if (command === "diff") {
      const { execSync } = require("child_process");
      try {
        const diff = execSync("git diff --no-color -100", { encoding: "utf-8" } as any);
        results.diff = diff.slice(0, 10000);
        results.success = true;
      } catch (e) {
        results.diff = "";
        results.success = true;
      }
    }
    
    // Git log command
    else if (command === "log") {
      const { execSync } = require("child_process");
      try {
        const log = execSync("git log --oneline -20", { encoding: "utf-8" } as any);
        results.log = log.slice(0, 3000);
        results.success = true;
      } catch (e) {
        results.log = "";
        results.success = true;
      }
    }
    
    // TypeScript check command
    else if (command === "typecheck") {
      const { execSync } = require("child_process");
      try {
        execSync("pnpm exec tsc --noEmit", { encoding: "utf-8", stdio: "pipe" } as any);
        results.success = true;
        results.message = "TypeScript check passed";
      } catch (e) {
        results.success = false;
        results.error = (e as Error).message;
      }
    }
    
    // List files command
    else if (command === "ls") {
      const fs = require("fs");
      const path = require("path");
      const dirPath = args?.path || ".";
      try {
        const files = fs.readdirSync(dirPath);
        results.files = files.slice(0, 100);
        results.success = true;
      } catch (e) {
        results.error = (e as Error).message;
        results.success = false;
      }
    }
    
    else {
      return NextResponse.json({ error: `Unknown command: ${command}` }, { status: 400 });
    }

    return NextResponse.json(results);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}