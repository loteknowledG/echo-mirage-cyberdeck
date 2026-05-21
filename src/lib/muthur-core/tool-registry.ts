import path from "node:path";
import { promises as fs } from "node:fs";
import { Bash, OverlayFs } from "just-bash";
import { convertDocumentToMarkdown } from "@/lib/muthur-document-conversion.server";
import type { ToolCall, ToolRegistry, ToolResult } from "./types";

const WORKSPACE_ROOT = path.resolve(process.cwd());
const WORKSPACE_MOUNT = "/workspace";

function isPathInsideWorkspace(targetPath: string): boolean {
  const root = path.resolve(WORKSPACE_ROOT);
  const abs = path.resolve(targetPath);
  if (abs === root) return true;
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  return abs.startsWith(prefix);
}

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

function getBoolArg(call: ToolCall, key: string, defaultValue: boolean): boolean {
  const raw = call.args[key];
  if (typeof raw === "boolean") return raw;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return defaultValue;
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

    if (action === "mkdir") {
      const abs = path.resolve(targetPath);
      if (!isPathInsideWorkspace(abs)) {
        return { ok: false, error: "mkdir is only allowed under the Echo Mirage workspace root." };
      }
      const recursive = getBoolArg(call, "recursive", true);
      await fs.mkdir(abs, { recursive });
      return {
        ok: true,
        output: {
          action,
          path: abs,
          recursive,
          created: true,
        },
      };
    }

    if (action === "write") {
      const abs = path.resolve(targetPath);
      if (!isPathInsideWorkspace(abs)) {
        return { ok: false, error: "write is only allowed under the Echo Mirage workspace root." };
      }
      if (!("content" in call.args)) {
        return { ok: false, error: 'write requires a "content" field (string; may be empty).' };
      }
      const raw = call.args.content;
      if (typeof raw !== "string") {
        return { ok: false, error: 'write "content" must be a string.' };
      }
      const content = raw;
      const append = getBoolArg(call, "append", false);
      const ensureDir = getBoolArg(call, "ensure_parent_dirs", true);
      if (ensureDir) {
        await fs.mkdir(path.dirname(abs), { recursive: true });
      }
      if (append) {
        await fs.appendFile(abs, content, "utf8");
      } else {
        await fs.writeFile(abs, content, "utf8");
      }
      const st = await fs.stat(abs);
      return {
        ok: true,
        output: {
          action,
          path: abs,
          bytesWritten: Buffer.byteLength(content, "utf8"),
          append,
          size: st.size,
          modifiedAt: st.mtime.toISOString(),
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

async function runConvertDocumentToMarkdown(call: ToolCall): Promise<ToolResult> {
  const filePath = getStringArg(call, "filePath") || getStringArg(call, "path");
  if (!filePath) {
    return { ok: false, error: "convert_document_to_markdown requires filePath." };
  }

  try {
    const result = convertDocumentToMarkdown(filePath);
    const preview = result.markdown.trim().slice(0, 1200);
    return {
      ok: true,
      output: {
        sourcePath: result.sourcePath,
        outputPath: result.outputPath,
        format: result.format,
        mimeType: "text/markdown",
        kind: "markdown",
        markdownLength: Buffer.byteLength(result.markdown, "utf8"),
        preview,
        markdown: result.markdown,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Document conversion failed.",
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
          "Access the machine running the dev server: ls, cat, stat anywhere; mkdir and write_text only inside the Echo Mirage workspace directory (project root).",
        run: runLocalFs,
      },
      clock: {
        name: "clock",
        description: "Reports the current local date and/or time from the server machine.",
        run: runClock,
      },
      convert_document_to_markdown: {
        name: "convert_document_to_markdown",
        description:
          "Converts a local .pdf or .docx file to markdown using Microsoft MarkItDown (pip install 'markitdown[pdf,docx]'). Returns markdown for OperatorMarkdownViewer.",
        run: runConvertDocumentToMarkdown,
      },
    },
  };
}
