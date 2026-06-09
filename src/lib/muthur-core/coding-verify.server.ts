import { promises as fs } from "node:fs";
import path from "node:path";
import { ENABLE_AUTOMATION } from "@/lib/cyberdeck/automation-config";
import { runGitDiff, runWorkspaceExec } from "@/lib/muthur-core/workspace-tools.server";
import type { MuthurCodingVerifyReceipt, MuthurToolExecutionContext } from "@/lib/muthur-core/types";

const RECEIPT_DIR = path.join(process.cwd(), ".muthur", "receipts", "coding");
const TSC_COMMAND = "pnpm exec tsc --noEmit";
const TAIL_CHARS = 1200;

function tail(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= TAIL_CHARS) return trimmed;
  return `…${trimmed.slice(-TAIL_CHARS)}`;
}

export function formatCodingVerifyForStream(receipt: MuthurCodingVerifyReceipt): string {
  const status = receipt.passed ? "PASS" : "FAIL";
  const lines = [
    "",
    `[MUTHUR_VERIFY] ${status} // tsc exit ${receipt.tsc_exit_code}`,
    `TOUCHED // ${receipt.touched_paths.join(", ") || "(none)"}`,
    `RECEIPT // ${receipt.receipt_path}`,
  ];
  if (receipt.git_diff_stat.trim()) {
    lines.push("GIT_DIFF_STAT", receipt.git_diff_stat.trim());
  }
  if (receipt.tsc_stderr_tail.trim()) {
    lines.push("TSC_STDERR", receipt.tsc_stderr_tail.trim());
  }
  return `${lines.join("\n")}\n`;
}

export async function runCodingVerify(touchedPaths: string[]): Promise<MuthurCodingVerifyReceipt> {
  await fs.mkdir(RECEIPT_DIR, { recursive: true });

  const diffResult = runGitDiff({ stat: true });
  const diffOutput =
    diffResult.ok && diffResult.output && typeof diffResult.output === "object"
      ? String((diffResult.output as { stdout?: string }).stdout ?? "")
      : diffResult.error ?? "";

  const tscResult = runWorkspaceExec(TSC_COMMAND);
  const tscOutput =
    tscResult.output && typeof tscResult.output === "object"
      ? (tscResult.output as { stdout?: string; stderr?: string; exitCode?: number })
      : {};
  const tscExit =
    typeof tscOutput.exitCode === "number" ? tscOutput.exitCode : tscResult.ok ? 0 : 1;
  const tscStderr = tail(
    [tscOutput.stderr, tscOutput.stdout, tscResult.error].filter(Boolean).join("\n"),
  );

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const receiptPath = path.join(RECEIPT_DIR, `${stamp}_coding-verify.json`);

  const receipt: MuthurCodingVerifyReceipt = {
    timestamp: new Date().toISOString(),
    passed: tscExit === 0,
    touched_paths: [...touchedPaths],
    tsc_exit_code: tscExit,
    tsc_stderr_tail: tscStderr,
    git_diff_stat: diffOutput.trim(),
    receipt_path: receiptPath,
  };

  await fs.writeFile(receiptPath, JSON.stringify(receipt, null, 2), "utf8");
  return receipt;
}

/** After mutating tools, auto-run tsc + git diff --stat and stream a receipt. */
export async function maybeFinalizeCodingVerify(
  ctx: MuthurToolExecutionContext,
  write: (chunk: string) => void,
): Promise<MuthurCodingVerifyReceipt | null> {
  if (!ENABLE_AUTOMATION) return null;
  if (ctx.codingVerify) return ctx.codingVerify;
  if (ctx.codingTouches.length === 0) return null;

  write("\n⏳ MUTHUR // verify: git diff --stat + tsc --noEmit…\n");
  const receipt = await runCodingVerify(ctx.codingTouches);
  ctx.codingVerify = receipt;
  write(formatCodingVerifyForStream(receipt));
  return receipt;
}
