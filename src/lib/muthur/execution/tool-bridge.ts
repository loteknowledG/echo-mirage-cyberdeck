import type { CreateMuthurActionInput } from "./execution-types";

export function openAiToolCallToAction(
  functionName: string,
  args: Record<string, unknown>,
): CreateMuthurActionInput | null {
  if (functionName === "justbash") {
    const command = typeof args.command === "string" ? args.command.trim() : "";
    if (!command) return null;
    return { type: "shell_command", source: "muthur", payload: { command, tool: functionName } };
  }

  if (functionName === "localfs") {
    const action = typeof args.action === "string" ? args.action.toLowerCase() : "";
    const filePath = typeof args.path === "string" ? args.path.trim() : "";
    if (!filePath) return null;
    if (action === "cat") {
      return { type: "read_file", source: "muthur", payload: { path: filePath, tool: functionName } };
    }
    if (action === "write") {
      return {
        type: "write_file",
        source: "muthur",
        payload: {
          path: filePath,
          content: typeof args.content === "string" ? args.content : "",
          tool: functionName,
        },
      };
    }
    return null;
  }

  return null;
}

export function formatExecutionResultsForOpenAiTool(
  functionName: string,
  action: {
    status: string;
    result?: {
      success: boolean;
      stdout?: string;
      stderr?: string;
      exit_code?: number;
      duration_ms: number;
      metadata?: Record<string, unknown>;
      verification_notes?: string;
    };
    error?: string;
  },
): string {
  if (action.status === "unsupported") {
    return `[TOOL UNSUPPORTED] ${functionName}\n\n${action.error || action.result?.verification_notes || "Not implemented in Phase 1."}`;
  }
  if (action.status === "blocked") {
    return `[TOOL BLOCKED] ${functionName}\n\nAwaiting operator approval in execution pane.`;
  }
  if (action.status === "cancelled") {
    return `[TOOL CANCELLED] ${functionName}\n\n${action.error || "Cancelled."}`;
  }
  if (!action.result?.success) {
    return `[TOOL FAILURE] ${functionName}\n\n${action.error || action.result?.stderr || "Unknown error"}`;
  }

  const result = action.result;
  if (functionName === "clock") {
    const meta = result.metadata ?? {};
    return `[TOOL OK] clock\n\n${JSON.stringify(meta, null, 2)}`;
  }
  if (functionName === "localfs") {
    return `[TOOL OK] localfs\n\n${result.stdout ?? JSON.stringify(result.metadata ?? {}, null, 2)}`;
  }
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  return `[TOOL OK] ${functionName}\n\nstdout:\n${stdout}${stderr ? `\n\nstderr:\n${stderr}` : ""}`;
}
