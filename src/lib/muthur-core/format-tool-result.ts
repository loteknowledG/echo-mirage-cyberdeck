/** Formatting for tool outputs (MUTHUR / cyberdeck-chat). */

export { formatSuggestOperatorEditResult } from "@/lib/muthur-core/suggest-operator-edit";

export function formatWorkspaceExecResult(result: unknown): string {
  if (!result || typeof result !== "object") {
    return "[TOOL] workspace_exec returned no output.";
  }

  const payload = result as {
    command?: string;
    cwd?: string;
    stdout?: string;
    stderr?: string;
    exitCode?: number;
    duration_ms?: number;
  };

  const parts = [
    "[TOOL] WORKSPACE_EXEC // REAL DISK",
    payload.command ? `COMMAND // ${payload.command}` : null,
    payload.cwd ? `CWD // ${payload.cwd}` : null,
    typeof payload.exitCode === "number" ? `EXIT // ${payload.exitCode}` : null,
    typeof payload.duration_ms === "number" ? `DURATION_MS // ${payload.duration_ms}` : null,
    payload.stdout ? `STDOUT\n${payload.stdout.trimEnd()}` : null,
    payload.stderr ? `STDERR\n${payload.stderr.trimEnd()}` : null,
  ].filter(Boolean);

  return parts.join("\n\n");
}

export function formatSamusHandsEyesResult(result: unknown): string {
  if (!result || typeof result !== "object") {
    return "[TOOL] samus_hands_eyes returned no output.";
  }

  const payload = result as {
    command?: string;
    stdout?: string;
    stderr?: string;
    exitCode?: number;
    duration_ms?: number;
  };

  const parts = [
    "[TOOL] SAMUS_HANDS_EYES // LOCAL WINDOWS",
    payload.command ? `COMMAND // ${payload.command}` : null,
    typeof payload.exitCode === "number" ? `EXIT // ${payload.exitCode}` : null,
    typeof payload.duration_ms === "number" ? `DURATION_MS // ${payload.duration_ms}` : null,
    payload.stdout ? `STDOUT\n${payload.stdout.trimEnd()}` : null,
    payload.stderr ? `STDERR\n${payload.stderr.trimEnd()}` : null,
  ].filter(Boolean);

  return parts.join("\n\n");
}

export function formatGitStatusResult(result: unknown): string {
  if (!result || typeof result !== "object") {
    return "[TOOL] git_status returned no output.";
  }

  const payload = result as { stdout?: string; exitCode?: number };
  const body = (payload.stdout ?? "").trimEnd();
  return [
    "[TOOL] GIT_STATUS // REAL DISK",
    typeof payload.exitCode === "number" ? `EXIT // ${payload.exitCode}` : null,
    body ? `STATUS\n${body}` : "STATUS\n(clean working tree)",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function formatGitDiffResult(result: unknown): string {
  if (!result || typeof result !== "object") {
    return "[TOOL] git_diff returned no output.";
  }

  const payload = result as { stdout?: string; exitCode?: number };
  const body = (payload.stdout ?? "").trimEnd();
  return [
    "[TOOL] GIT_DIFF // REAL DISK",
    typeof payload.exitCode === "number" ? `EXIT // ${payload.exitCode}` : null,
    body ? `DIFF\n${body}` : "DIFF\n(no changes)",
  ]
    .filter(Boolean)
    .join("\n\n");
}

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
    "[TOOL] JUSTBASH // EPHEMERAL MIRROR (writes do not persist — use localfs or workspace_exec)",
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

export function formatOpenOperatorFileResult(result: unknown): string {
  if (!result || typeof result !== "object") {
    return "[TOOL] open_operator_file returned no output.";
  }

  const payload = result as {
    filePath?: string;
    fileName?: string;
    mode?: string;
    queued?: boolean;
  };

  const parts = [
    "[TOOL OK] OPEN_OPERATOR_FILE // QUEUED_FOR_OPERATOR_PANE",
    "The deck will load this file in Monaco on the operator screen.",
    payload.filePath ? `FILE // ${payload.filePath}` : null,
    payload.fileName ? `NAME // ${payload.fileName}` : null,
    payload.mode ? `MODE // ${payload.mode.toUpperCase()}` : null,
  ].filter(Boolean);

  return parts.join("\n\n");
}

export function formatOperatorBrowserResult(result: unknown): string {
  if (!result || typeof result !== "object") {
    return "[TOOL] operator_browser returned no output.";
  }

  const payload = result as {
    kind?: string;
    url?: string;
    selector?: string;
    value?: string;
    live?: { url?: string; title?: string; pageText?: string; status?: number; engine?: string };
    liveError?: string;
  };

  const parts = [
    "[TOOL OK] OPERATOR_BROWSER // QUEUED_FOR_OPERATOR_WEB_PANE",
    "The deck will mirror this action in the operator web pane.",
    payload.kind ? `ACTION // ${payload.kind.toUpperCase()}` : null,
    payload.url ? `TARGET // ${payload.url}` : null,
    payload.selector ? `SELECTOR // ${payload.selector}` : null,
    payload.value ? `VALUE // ${payload.value}` : null,
  ].filter(Boolean);

  if (payload.live) {
    const live = payload.live;
    parts.push("LIVE PAGE (server fetch during tool round):");
    if (live.url) parts.push(`URL // ${live.url}`);
    if (live.title) parts.push(`TITLE // ${live.title}`);
    if (typeof live.status === "number") parts.push(`HTTP // ${live.status}`);
    if (live.engine) parts.push(`ENGINE // ${live.engine.toUpperCase()}`);
    if (live.pageText?.trim()) {
      parts.push(`PAGE TEXT:\n${live.pageText.trim()}`);
    }
  } else if (payload.liveError) {
    parts.push(`LIVE FETCH // FAILED // ${payload.liveError}`);
    parts.push(
      "Do not call operator_browser snapshot again in a loop. Answer from training knowledge or explain the fetch failure.",
    );
  } else if (payload.kind === "snapshot") {
    parts.push(
      "Snapshot text is not available yet. Use goto first, or answer without browser if this was a general knowledge question.",
    );
  }

  return parts.join("\n\n");
}

export function formatSurveyAutoConnectResult(result: unknown): string {
  if (!result || typeof result !== "object") {
    return "[TOOL] survey_auto_connect returned no output.";
  }

  const payload = result as {
    queued?: boolean;
    force?: boolean;
    echoHost?: string;
    echoHttpPort?: number;
    preflight?: {
      echoReachable?: boolean;
      miragePinAvailable?: boolean;
      powerfistPinAvailable?: boolean;
      pairedMirageCount?: number;
      pairedPowerfist?: boolean;
      reason?: string;
    };
  };

  const pre = payload.preflight;
  const parts = [
    "[TOOL OK] SURVEY_AUTO_CONNECT // QUEUED_FOR_CYBERDECK",
    "The deck will wire Echo ↔ Mirage ↔ PowerFist TEAM LINKS in this browser session — no Survey tab clicks.",
    payload.echoHost ? `ECHO // ${payload.echoHost}:${payload.echoHttpPort ?? 3050}` : null,
    pre?.echoReachable
      ? `PREFLIGHT // echo=ok mirage_pin=${pre.miragePinAvailable ? "yes" : "no"} powerfist_pin=${pre.powerfistPinAvailable ? "yes" : "no"} paired_mirage=${pre.pairedMirageCount ?? 0} paired_powerfist=${pre.pairedPowerfist ? "yes" : "no"}`
      : null,
    pre?.reason ? `NOTE // ${pre.reason}` : null,
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
    "[TOOL OK] CONVERT_DOCUMENT_TO_MARKDOWN // MARKITDOWN",
    "The converted markdown will open in the operator pane for editing.",
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
