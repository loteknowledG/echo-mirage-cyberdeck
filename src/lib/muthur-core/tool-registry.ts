import path from "node:path";
import { promises as fs } from "node:fs";
import { Bash, OverlayFs } from "just-bash";
import type { ToolCall, ToolRegistry, ToolResult } from "./types";

const WORKSPACE_ROOT = path.resolve(process.cwd());
const WORKSPACE_MOUNT = "/workspace";

const overlayFs = new OverlayFs({
  root: WORKSPACE_ROOT,
  mountPoint: WORKSPACE_MOUNT,
});

const bash = new Bash({
  fs: overlayFs,
  cwd: overlayFs.getMountPoint(),
});

function toCommand(call: ToolCall): string {
  const raw = call.args.command;
  return typeof raw === "string" ? raw.trim() : "";
}

async function runJustBash(call: ToolCall): Promise<ToolResult> {
  const command = toCommand(call);
  if (!command) {
    return { ok: false, error: "No bash command provided." };
  }

  try {
    const result = await bash.exec(command);
    return {
      ok: result.exitCode === 0,
      output: {
        command,
        cwd: overlayFs.getMountPoint(),
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      },
      error: result.exitCode === 0 ? undefined : result.stderr || `Command exited with ${result.exitCode}.`,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "just-bash execution failed.",
    };
  }
}

function getStringArg(call: ToolCall, key: string): string {
  const raw = call.args[key];
  return typeof raw === "string" ? raw.trim() : "";
}

async function runLocalFs(call: ToolCall): Promise<ToolResult> {
  const action = getStringArg(call, "action").toLowerCase();
  const targetPath = getStringArg(call, "path");

  if (!action || !targetPath) {
    return { ok: false, error: "Local FS tool requires both action and path." };
  }

  try {
    if (action === "ls") {
      const entries = await fs.readdir(targetPath, { withFileTypes: true });
      const lines = entries.map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name));
      return {
        ok: true,
        output: {
          action,
          path: targetPath,
          entries: lines,
        },
      };
    }

    if (action === "cat") {
      const content = await fs.readFile(targetPath, "utf8");
      return {
        ok: true,
        output: {
          action,
          path: targetPath,
          content,
        },
      };
    }

    if (action === "stat") {
      const stats = await fs.stat(targetPath);
      return {
        ok: true,
        output: {
          action,
          path: targetPath,
          isDirectory: stats.isDirectory(),
          size: stats.size,
          modifiedAt: stats.mtime.toISOString(),
        },
      };
    }

    return { ok: false, error: `Unsupported local FS action: ${action}` };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Local FS inspection failed.",
    };
  }
}

async function runClock(call: ToolCall): Promise<ToolResult> {
  const mode = getStringArg(call, "mode").toLowerCase() || "datetime";
  const now = new Date();

  return {
    ok: true,
    output: {
      mode,
      iso: now.toISOString(),
      local: now.toLocaleString(),
      time: now.toLocaleTimeString(),
      date: now.toLocaleDateString(),
    },
  };
}

export function createMuthurToolRegistry(): ToolRegistry {
  return {
    tools: {
      justbash: {
        name: "justbash",
        description:
          "Runs a bash command against a copy-on-write mirror of the Echo Mirage workspace. Reads the real project; writes stay in memory.",
        run: runJustBash,
      },
      localfs: {
        name: "localfs",
        description:
          "Read-only inspection of local machine paths. Supports ls, cat, and stat on real desktop filesystem paths.",
        run: runLocalFs,
      },
      clock: {
        name: "clock",
        description: "Reports the current local date and/or time from the server machine.",
        run: runClock,
      },
    },
  };
}
