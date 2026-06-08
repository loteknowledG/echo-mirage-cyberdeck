/** Formatting for tool outputs (MUTHUR / cyberdeck-chat). */

export { formatSuggestOperatorEditResult } from "@/lib/muthur-core/suggest-operator-edit";

export function formatJustBashResult(result: unknown): string {
  if (!result || typeof result !== "object") {
    return "[TOOL] justbash returned no output.";
  }

  const payload = result as {
    command?: string;
    cwd?: string;
    stdout?: string;
    stderr?: string;
    exitCode?: number;
  };

  const parts = [
    "[TOOL] JUSTBASH // WORKSPACE MIRROR",
    payload.command ? `COMMAND // ${payload.command}` : null,
    payload.cwd ? `CWD // ${payload.cwd}` : null,
    typeof payload.exitCode === "number" ? `EXIT // ${payload.exitCode}` : null,
    payload.stdout ? `STDOUT\n${payload.stdout.trimEnd()}` : null,
    payload.stderr ? `STDERR\n${payload.stderr.trimEnd()}` : null,
  ].filter(Boolean);

  return parts.join("\n\n");
}

export function formatObserveOperatorPaneResult(result: unknown): string {
  if (!result || typeof result !== "object") {
    return "[TOOL] observe_operator_pane returned no output.";
  }

  const payload = result as {
    observation?: unknown;
    authority?: string;
  };

  return `[TOOL OK] observe_operator_pane\n\n${JSON.stringify(payload.observation ?? { status: "NO_VISIBLE_OBSERVATION" }, null, 2)}`;
}

export function formatLocalFsResult(result: unknown): string {
  if (!result || typeof result !== "object") {
    return "[TOOL] LOCALFS returned no output.";
  }

  const payload = result as {
    action?: string;
    path?: string;
    entries?: string[];
    content?: string;
    isDirectory?: boolean;
    size?: number;
    modifiedAt?: string;
    recursive?: boolean;
    created?: boolean;
    bytesWritten?: number;
    append?: boolean;
  };

  const parts = [
    "[TOOL] LOCALFS // CLIENT MACHINE",
    payload.action ? `ACTION // ${payload.action.toUpperCase()}` : null,
    payload.path ? `PATH // ${payload.path}` : null,
    Array.isArray(payload.entries) ? `ENTRIES\n${payload.entries.join("\n")}` : null,
    typeof payload.content === "string" ? `CONTENT\n${payload.content.trimEnd()}` : null,
    typeof payload.isDirectory === "boolean" ? `DIRECTORY // ${payload.isDirectory ? "YES" : "NO"}` : null,
    typeof payload.size === "number" ? `SIZE // ${payload.size}` : null,
    payload.modifiedAt ? `MODIFIED // ${payload.modifiedAt}` : null,
    typeof payload.recursive === "boolean" ? `RECURSIVE // ${payload.recursive ? "YES" : "NO"}` : null,
    typeof payload.created === "boolean" ? `CREATED // ${payload.created ? "YES" : "NO"}` : null,
    typeof payload.bytesWritten === "number" ? `BYTES_WRITTEN // ${payload.bytesWritten}` : null,
    typeof payload.append === "boolean" ? `APPEND // ${payload.append ? "YES" : "NO"}` : null,
  ].filter(Boolean);

  return parts.join("\n\n");
}

export function formatClockResult(result: unknown): string {
  if (!result || typeof result !== "object") {
    return "[TOOL] CLOCK returned no output.";
  }

  const payload = result as {
    mode?: string;
    iso?: string;
    local?: string;
    time?: string;
    date?: string;
  };

  const parts = [
    "[TOOL] CLOCK // SERVER TIME",
    payload.mode ? `MODE // ${payload.mode.toUpperCase()}` : null,
    payload.time ? `TIME // ${payload.time}` : null,
    payload.date ? `DATE // ${payload.date}` : null,
    payload.local ? `LOCAL // ${payload.local}` : null,
    payload.iso ? `ISO // ${payload.iso}` : null,
  ].filter(Boolean);

  return parts.join("\n\n");
}

export function formatConvertDocumentResult(result: unknown): string {
  if (!result || typeof result !== "object") {
    return "[TOOL] convert_document_to_markdown returned no output.";
  }

  const payload = result as {
    sourcePath?: string;
    outputPath?: string;
    format?: string;
    markdownLength?: number;
    preview?: string;
  };

  const parts = [
    "[TOOL] CONVERT_DOCUMENT_TO_MARKDOWN // MARKITDOWN",
    payload.sourcePath ? `SOURCE // ${payload.sourcePath}` : null,
    payload.outputPath ? `OUTPUT // ${payload.outputPath}` : null,
    payload.format ? `FORMAT // ${payload.format}` : null,
    typeof payload.markdownLength === "number"
      ? `MARKDOWN_BYTES // ${payload.markdownLength}`
      : null,
    payload.preview ? `PREVIEW\n${payload.preview.trimEnd()}` : null,
  ].filter(Boolean);

  return parts.join("\n\n");
}

export function formatExportMarkdownToDocxResult(result: unknown): string {
  if (!result || typeof result !== "object") {
    return "[TOOL] export_markdown_to_docx returned no output.";
  }

  const payload = result as {
    sourcePath?: string;
    outputPath?: string;
    suggestedFilename?: string;
    bytes?: number;
  };

  const parts = [
    "[TOOL] EXPORT_MARKDOWN_TO_DOCX // @mohtasham/md-to-docx",
    payload.sourcePath ? `SOURCE // ${payload.sourcePath}` : null,
    payload.outputPath ? `OUTPUT // ${payload.outputPath}` : null,
    payload.suggestedFilename ? `FILENAME // ${payload.suggestedFilename}` : null,
    typeof payload.bytes === "number" ? `DOCX_BYTES // ${payload.bytes}` : null,
  ].filter(Boolean);

  return parts.join("\n\n");
}

export function formatExportMarkdownToPdfResult(result: unknown): string {
  if (!result || typeof result !== "object") {
    return "[TOOL] export_markdown_to_pdf returned no output.";
  }

  const payload = result as {
    sourcePath?: string;
    outputPath?: string;
    suggestedFilename?: string;
    bytes?: number;
  };

  const parts = [
    "[TOOL] EXPORT_MARKDOWN_TO_PDF // md-to-pdf",
    payload.sourcePath ? `SOURCE // ${payload.sourcePath}` : null,
    payload.outputPath ? `OUTPUT // ${payload.outputPath}` : null,
    payload.suggestedFilename ? `FILENAME // ${payload.suggestedFilename}` : null,
    typeof payload.bytes === "number" ? `PDF_BYTES // ${payload.bytes}` : null,
  ].filter(Boolean);

  return parts.join("\n\n");
}

/** Narrated summary for legacy heuristic responses (not used in OpenAI tool messages). */
export function summarizeToolResult(toolName: string, intent: string, output: unknown): string {
  if (toolName === "localfs" && output && typeof output === "object") {
    const payload = output as {
      action?: string;
      path?: string;
      entries?: string[];
      content?: string;
      isDirectory?: boolean;
      size?: number;
      modifiedAt?: string;
    };

    if (payload.action === "ls" && Array.isArray(payload.entries)) {
      const preview = payload.entries.slice(0, 12).join(", ");
      const more = payload.entries.length > 12 ? `, plus ${payload.entries.length - 12} more` : "";
      return `Acknowledged. I inspected ${payload.path}. ${payload.entries.length} entries visible: ${preview}${more}.`;
    }

    if (payload.action === "cat" && typeof payload.content === "string") {
      const snippet = payload.content.trim().slice(0, 500);
      return `Acknowledged. I opened ${payload.path}.\n\n${snippet}${payload.content.trim().length > snippet.length ? "\n…" : ""}`;
    }

    if (payload.action === "stat") {
      return `Acknowledged. ${payload.path} ${payload.isDirectory ? "is a directory" : "is a file"}${typeof payload.size === "number" ? `, size ${payload.size} bytes` : ""}${payload.modifiedAt ? `, modified ${payload.modifiedAt}` : ""}.`;
    }
  }

  if (toolName === "justbash" && output && typeof output === "object") {
    const payload = output as {
      command?: string;
      stdout?: string;
      stderr?: string;
      exitCode?: number;
    };
    const body = (payload.stdout || payload.stderr || "").trim();
    if ((payload.command || "").startsWith("rg ") && payload.exitCode === 0) {
      const hits = body
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      if (hits.length === 0) {
        return "Negative. No matching files were found in the workspace.";
      }
      const preview = hits.slice(0, 12).join("\n");
      const more = hits.length > 12 ? `\n…plus ${hits.length - 12} more.` : "";
      return `Affirmative. I found ${hits.length} matching file${hits.length === 1 ? "" : "s"} in the workspace.\n\n${preview}${more}`;
    }
    const snippet = body.slice(0, 800);
    return `Acknowledged. I inspected the workspace with \`${payload.command || "just-bash"}\`.\n\n${snippet}${body.length > snippet.length ? "\n…" : ""}`;
  }

  if (toolName === "clock" && output && typeof output === "object") {
    const payload = output as {
      mode?: string;
      local?: string;
      time?: string;
      date?: string;
    };

    if (payload.mode === "time" && payload.time) {
      return `Current local time: ${payload.time}.`;
    }

    if (payload.mode === "date" && payload.date) {
      return `Current local date: ${payload.date}.`;
    }

    if (payload.local) {
      return `Current local date and time: ${payload.local}.`;
    }
  }

  return `Acknowledged. I used ${toolName} to inspect that request: ${intent}`;
}
