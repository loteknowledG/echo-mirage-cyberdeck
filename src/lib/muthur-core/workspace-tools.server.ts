import { execSync } from "node:child_process";
import path from "node:path";
import {
  isPathInsideWorkspace,
  validateShellCommand,
  WORKSPACE_ROOT,
} from "@/lib/muthur/execution/safety-policy";
import type { ToolResult } from "@/lib/muthur-core/types";

export { WORKSPACE_ROOT };

const EXEC_TIMEOUT_MS = 120_000;
const MAX_OUTPUT_CHARS = 12_000;

function truncateOutput(text: string): string {
  if (text.length <= MAX_OUTPUT_CHARS) return text;
  return `${text.slice(0, MAX_OUTPUT_CHARS)}\n…[truncated ${text.length - MAX_OUTPUT_CHARS} chars]`;
}

function execInWorkspace(command: string): ToolResult {
  const startedAt = Date.now();
  try {
    const stdout = execSync(command, {
      encoding: "utf-8",
      cwd: WORKSPACE_ROOT,
      timeout: EXEC_TIMEOUT_MS,
      stdio: ["ignore", "pipe", "pipe"],
      ...(process.platform === "win32" ? { shell: "cmd.exe" } : {}),
      maxBuffer: 4 * 1024 * 1024,
    });
    return {
      ok: true,
      output: {
        command,
        cwd: WORKSPACE_ROOT,
        stdout: truncateOutput(String(stdout ?? "")),
        stderr: "",
        exitCode: 0,
        duration_ms: Date.now() - startedAt,
      },
    };
  } catch (error) {
    const err = error as {
      status?: number;
      stdout?: string | Buffer;
      stderr?: string | Buffer;
      message?: string;
    };
    const stdout = typeof err.stdout === "string" ? err.stdout : err.stdout?.toString("utf8") ?? "";
    const stderr =
      (typeof err.stderr === "string" ? err.stderr : err.stderr?.toString("utf8") ?? "") ||
      err.message ||
      "Command failed.";
    const exitCode = typeof err.status === "number" ? err.status : 1;
    return {
      ok: exitCode === 0,
      output: {
        command,
        cwd: WORKSPACE_ROOT,
        stdout: truncateOutput(stdout),
        stderr: truncateOutput(stderr),
        exitCode,
        duration_ms: Date.now() - startedAt,
      },
      error: exitCode === 0 ? undefined : stderr.slice(0, 500) || `Exit ${exitCode}`,
    };
  }
}

/** Run an allowlisted shell command on the real workspace disk (persists). */
export function runWorkspaceExec(command: string): ToolResult {
  const trimmed = command.trim();
  const validation = validateShellCommand(trimmed);
  if (!validation.ok) {
    return { ok: false, error: validation.reason };
  }
  return execInWorkspace(trimmed);
}

/** `git status --short` in the Echo Mirage repo root. */
export function runGitStatus(): ToolResult {
  return execInWorkspace("git status --short");
}

/** `git diff` scoped to the workspace; optional path and --stat summary. */
export function runGitDiff(args: { path?: string; stat?: boolean }): ToolResult {
  const segments = ["git", "diff"];
  if (args.stat) {
    segments.push("--stat");
  }

  const rawPath = args.path?.trim();
  if (rawPath) {
    const abs = path.resolve(rawPath);
    if (!isPathInsideWorkspace(abs)) {
      return { ok: false, error: "git_diff path must be inside the Echo Mirage workspace." };
    }
    segments.push("--", abs);
  }

  return execInWorkspace(segments.join(" "));
}
