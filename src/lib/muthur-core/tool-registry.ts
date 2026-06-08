import path from "node:path";
import { promises as fs } from "node:fs";
import { Bash, OverlayFs } from "just-bash";
import { convertDocumentToMarkdown } from "@/lib/muthur-document-conversion.server";
import { convertMarkdownFileToDocx } from "@/lib/markdown-to-docx.server";
import { convertMarkdownFileToPdf } from "@/lib/markdown-to-pdf.server";
import { getLatestMuthurObservation } from "@/lib/muthur/observation/observation-store.server";
import { parseSuggestOperatorEditArgs } from "@/lib/muthur-core/suggest-operator-edit";
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
  if (/\bfind\s+\/(?:\s|$)/.test(command) || /\bfind\s+\/\S/.test(command)) {
    return {
      ok: false,
      error:
        "Blocked: searching / is not allowed. The user's file is already open in the operator pane — use observe_operator_pane or convert_document_to_markdown with that file path.",
    };
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
    const result = convertDocumentToMarkdown(filePath, {
      projectRoot: process.cwd(),
    });
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

async function runExportMarkdownToDocx(call: ToolCall): Promise<ToolResult> {
  const filePath = getStringArg(call, "filePath") || getStringArg(call, "path");
  if (!filePath) {
    return { ok: false, error: "export_markdown_to_docx requires filePath." };
  }

  try {
    const result = await convertMarkdownFileToDocx(filePath);
    return {
      ok: true,
      output: {
        sourcePath: result.sourcePath,
        outputPath: result.outputPath,
        suggestedFilename: result.suggestedFilename,
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        kind: "docx",
        bytes: result.buffer.length,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Markdown to DOCX export failed.",
    };
  }
}

async function runExportMarkdownToPdf(call: ToolCall): Promise<ToolResult> {
  const filePath = getStringArg(call, "filePath") || getStringArg(call, "path");
  if (!filePath) {
    return { ok: false, error: "export_markdown_to_pdf requires filePath." };
  }

  try {
    const result = await convertMarkdownFileToPdf(filePath);
    return {
      ok: true,
      output: {
        sourcePath: result.sourcePath,
        outputPath: result.outputPath,
        suggestedFilename: result.suggestedFilename,
        mimeType: "application/pdf",
        kind: "pdf",
        bytes: result.buffer.length,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Markdown to PDF export failed.",
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

async function runObserveOperatorPane(call: ToolCall): Promise<ToolResult> {
  const surfaceRaw = getStringArg(call, "surface");
  const requestedSurface =
    surfaceRaw === "property-manager" || surfaceRaw === "cyberdeck" ? surfaceRaw : undefined;
  const observation = getLatestMuthurObservation(requestedSurface);
  return {
    ok: true,
    output: {
      observation: observation ?? { status: "NO_VISIBLE_OBSERVATION" },
    },
  };
}

async function runSuggestOperatorEdit(call: ToolCall): Promise<ToolResult> {
  const parsed = parseSuggestOperatorEditArgs(call.args);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }

  const observation = getLatestMuthurObservation("cyberdeck");
  const editor = observation?.editor;
  if (!editor?.active) {
    return {
      ok: false,
      error: "No active operator editor. Open a markdown or code file in the operator pane first.",
    };
  }

  return {
    ok: true,
    output: {
      queued: true,
      edit: parsed.edit,
      fileName: editor.fileName ?? null,
      filePath: editor.filePath ?? null,
    },
  };
}

export function createMuthurToolRegistry(): ToolRegistry {
  return {
    tools: {
      observe_operator_pane: {
        name: "observe_operator_pane",
        description:
          "Read the latest visible operator surface state (open file, cursor, excerpt). Read-only — no edits or actions.",
        run: runObserveOperatorPane,
      },
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
      suggest_operator_edit: {
        name: "suggest_operator_edit",
        description:
          "Apply a typed edit in the operator Monaco editor (markdown/code/text). Auto-applies in the operator pane; Ctrl+Z to undo.",
        run: runSuggestOperatorEdit,
      },
      convert_document_to_markdown: {
        name: "convert_document_to_markdown",
        description:
          "Converts a local .pdf or .docx file to markdown using Microsoft MarkItDown (pip install 'markitdown[pdf,docx]'). Returns markdown for OperatorMarkdownViewer.",
        run: runConvertDocumentToMarkdown,
      },
      export_markdown_to_docx: {
        name: "export_markdown_to_docx",
        description:
          "Converts a local .md or .markdown file to Word (.docx) using @mohtasham/md-to-docx. Writes output beside the source file when possible.",
        run: runExportMarkdownToDocx,
      },
      export_markdown_to_pdf: {
        name: "export_markdown_to_pdf",
        description:
          "Converts a local .md or .markdown file to PDF using md-to-pdf (Puppeteer). Writes output beside the source file when possible.",
        run: runExportMarkdownToPdf,
      },
    },
  };
}
