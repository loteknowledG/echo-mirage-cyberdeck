import { NextRequest, NextResponse } from "next/server";
import { runCodingVerify } from "@/lib/muthur-core/coding-verify.server";
import { executeMuthurChatTool } from "@/lib/muthur-core/execute-openai-tool";
import { createMuthurToolRegistry } from "@/lib/muthur-core/tool-registry";
import { createMuthurToolExecutionContext } from "@/lib/muthur-core/types";
import { normalizeMuthurPosture } from "@/lib/muthur/muthur-posture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      toolName?: string;
      args?: Record<string, unknown>;
      posture?: string;
      uplinkMode?: string;
    };
    const toolName = typeof body.toolName === "string" ? body.toolName.trim() : "";
    if (!toolName) {
      return NextResponse.json({ ok: false, error: "toolName is required." }, { status: 400 });
    }

    const args = body.args && typeof body.args === "object" ? body.args : {};
    const ctx = createMuthurToolExecutionContext(normalizeMuthurPosture(body.posture ?? body.uplinkMode));
    const registry = createMuthurToolRegistry();

    if (toolName === "coding_verify") {
      const receipt = await runCodingVerify([]);
      ctx.codingVerify = receipt;
      const status = receipt.passed ? "PASS" : "FAIL";
      const text = [
        "[TOOL OK] CODING_VERIFY // MANUAL OVERRIDE",
        `STATUS // ${status}`,
        `TSC_EXIT // ${receipt.tsc_exit_code}`,
        receipt.git_diff_stat ? `GIT_DIFF_STAT\n${receipt.git_diff_stat}` : null,
        receipt.tsc_stderr_tail ? `TSC_STDERR\n${receipt.tsc_stderr_tail}` : null,
        `RECEIPT // ${receipt.receipt_path}`,
      ]
        .filter(Boolean)
        .join("\n\n");
      return NextResponse.json({
        ok: true,
        text,
        codingVerify: receipt,
        operatorOpenFile: ctx.operatorOpenFile,
        operatorEdits: ctx.operatorEdits,
        operatorConversion: ctx.operatorConversion,
      });
    }

    if (!registry.tools[toolName]) {
      return NextResponse.json({ ok: false, error: `Unknown tool: ${toolName}` }, { status: 400 });
    }

    const text = await executeMuthurChatTool(registry, toolName, JSON.stringify(args), ctx);
    const ok = !text.startsWith("[TOOL FAILURE]") && !text.startsWith("[TOOL ERROR]");

    return NextResponse.json({
      ok,
      text,
      codingVerify: ctx.codingVerify,
      operatorOpenFile: ctx.operatorOpenFile,
      operatorEdits: ctx.operatorEdits,
      operatorConversion: ctx.operatorConversion,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Tool execution failed." },
      { status: 500 },
    );
  }
}
