import path from "node:path";
import { promises as fs } from "node:fs";
import { Bash, OverlayFs } from "just-bash";
import { convertDocumentToMarkdown } from "@/lib/muthur-document-conversion.server";
import { convertMarkdownFileToDocx } from "@/lib/markdown-to-docx.server";
import { convertMarkdownFileToPdf } from "@/lib/markdown-to-pdf.server";
import { isOperatorWorkspaceTextPath } from "@/lib/operator-file-surface";
import { getLatestMuthurObservation } from "@/lib/muthur/observation/observation-store.server";
import { validateReadFilePath } from "@/lib/muthur/execution/safety-policy";
import { isLocalFsWriteAllowedForUplinkMode } from "@/lib/muthur-uplink-mode";
import { parseSuggestOperatorEditArgs } from "@/lib/muthur-core/suggest-operator-edit";
import {
  runGitDiff,
  runGitStatus,
  runWorkspaceExec,
} from "@/lib/muthur-core/workspace-tools.server";
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
      const uplinkMode = call.executionContext?.uplinkMode ?? "plan";
      if (!isLocalFsWriteAllowedForUplinkMode(uplinkMode, action)) {
        return {
          ok: false,
          error: "localfs mkdir requires Agent uplink mode.",
        };
      }
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
      const uplinkMode = call.executionContext?.uplinkMode ?? "plan";
      if (!isLocalFsWriteAllowedForUplinkMode(uplinkMode, action)) {
        return {
          ok: false,
          error: "localfs write requires Agent uplink mode. Use Debug for pane edits without save.",
        };
      }
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

async function runWorkspaceExecTool(call: ToolCall): Promise<ToolResult> {
  const command = toCommand(call);
  if (!command) {
    return { ok: false, error: "workspace_exec requires a command string." };
  }
  return runWorkspaceExec(command);
}

async function runGitStatusTool(_call: ToolCall): Promise<ToolResult> {
  return runGitStatus();
}

async function runGitDiffTool(call: ToolCall): Promise<ToolResult> {
  const filePath = getStringArg(call, "path");
  const stat = getBoolArg(call, "stat", false);
  return runGitDiff({ path: filePath || undefined, stat });
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

async function runOpenOperatorFile(call: ToolCall): Promise<ToolResult> {
  const filePath = getStringArg(call, "filePath") || getStringArg(call, "path");
  if (!filePath) {
    return { ok: false, error: "open_operator_file requires filePath." };
  }

  const validated = validateReadFilePath(
    path.isAbsolute(filePath) ? filePath : path.join(WORKSPACE_ROOT, filePath),
  );
  if (!validated.ok) {
    return { ok: false, error: validated.reason };
  }

  const abs = validated.abs;
  const ext = path.extname(abs).toLowerCase();
  if (ext === ".docx" || ext === ".pdf") {
    return {
      ok: false,
      error:
        ext === ".docx"
          ? "DOCX cannot open in Monaco directly — use convert_document_to_markdown first."
          : "PDF cannot open in Monaco — use convert_document_to_markdown or localfs cat.",
    };
  }
  if (!isOperatorWorkspaceTextPath(abs)) {
    return {
      ok: false,
      error:
        "File type is not Monaco-editable. Use a text/code/markdown path or convert_document_to_markdown for DOCX.",
    };
  }

  try {
    const stat = await fs.stat(abs);
    if (!stat.isFile()) {
      return { ok: false, error: "Path is not a file." };
    }
    if (stat.size > 2 * 1024 * 1024) {
      return { ok: false, error: "File is too large to open in the operator pane (>2 MB)." };
    }
    await fs.readFile(abs, "utf8");
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not read file.",
    };
  }

  const modeRaw = getStringArg(call, "mode").toLowerCase();
  const mode = modeRaw === "view" ? "view" : "edit";
  const fileName = path.basename(abs);

  return {
    ok: true,
    output: {
      queued: true,
      filePath: abs,
      fileName,
      mode,
    },
  };
}

async function runOperatorBrowser(call: ToolCall): Promise<ToolResult> {
  const action = getStringArg(call, "action").toLowerCase() || "goto";

  if (action === "goto") {
    const url = getStringArg(call, "url") || getStringArg(call, "query");
    if (!url) {
      return { ok: false, error: "operator_browser goto requires url or query." };
    }
    return { ok: true, output: { kind: "goto", url } };
  }

  if (action === "snapshot") {
    return { ok: true, output: { kind: "snapshot" } };
  }
  if (action === "back") {
    return { ok: true, output: { kind: "back" } };
  }
  if (action === "forward") {
    return { ok: true, output: { kind: "forward" } };
  }
  if (action === "reload") {
    return { ok: true, output: { kind: "reload" } };
  }
  if (action === "click") {
    const selector = getStringArg(call, "selector");
    if (!selector) return { ok: false, error: "operator_browser click requires selector." };
    return { ok: true, output: { kind: "click", selector } };
  }
  if (action === "type") {
    const selector = getStringArg(call, "selector");
    const value = getStringArg(call, "value");
    if (!selector) return { ok: false, error: "operator_browser type requires selector." };
    return { ok: true, output: { kind: "type", selector, value } };
  }
  if (action === "submit") {
    const selector = getStringArg(call, "selector");
    if (!selector) return { ok: false, error: "operator_browser submit requires selector." };
    return { ok: true, output: { kind: "submit", selector } };
  }

  return {
    ok: false,
    error: "operator_browser action must be goto, snapshot, back, forward, reload, click, type, or submit.",
  };
}

async function runSuggestOperatorEdit(call: ToolCall): Promise<ToolResult> {
  const parsed = parseSuggestOperatorEditArgs(call.args);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }

  const pendingOpen = call.executionContext?.operatorOpenFile;
  const observation = getLatestMuthurObservation("cyberdeck");
  const editor = observation?.editor;
  const hasOpenDocument = Boolean(observation?.visibleDocument?.trim());
  const hasTextContext = Boolean(
    editor?.content?.trim() || observation?.documentExcerpt?.trim(),
  );

  if (!editor?.active && !(hasOpenDocument && hasTextContext) && !pendingOpen) {
    return {
      ok: false,
      error:
        "No active operator document. Call open_operator_file first, or ask the operator to open a markdown/code file in the operator pane.",
    };
  }

  return {
    ok: true,
    output: {
      queued: true,
      edit: parsed.edit,
      fileName: editor?.fileName ?? pendingOpen?.fileName ?? observation?.visibleDocument ?? null,
      filePath: editor?.filePath ?? pendingOpen?.filePath ?? null,
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
      open_operator_file: {
        name: "open_operator_file",
        description:
          "Open a workspace text/markdown/code file in the operator Monaco editor on the operator's screen. Use before suggest_operator_edit when nothing is open.",
        run: runOpenOperatorFile,
      },
      operator_browser: {
        name: "operator_browser",
        description:
          "Control the operator web pane: goto URL or search query, snapshot page text, back/forward/reload, click/type/submit by CSS selector. Use for web research — not for local disk paths (use localfs).",
        run: runOperatorBrowser,
      },
      workspace_exec: {
        name: "workspace_exec",
        description:
          "Run allowlisted shell commands on the real workspace disk (pnpm tsc/lint/build/e2e, git).",
        run: runWorkspaceExecTool,
      },
      git_status: {
        name: "git_status",
        description: "git status --short on the real Echo Mirage repo.",
        run: runGitStatusTool,
      },
      git_diff: {
        name: "git_diff",
        description: "git diff on the real Echo Mirage repo; optional path and stat summary.",
        run: runGitDiffTool,
      },
      justbash: {
        name: "justbash",
        description:
          "Ephemeral mirror only — reads real files; writes do not persist. Use for rg/ls/cat search, not builds or git.",
        run: runJustBash,
      },
      localfs: {
        name: "localfs",
        description:
          "Real disk: ls, cat, stat anywhere; mkdir and write only inside the Echo Mirage workspace root.",
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
