import type { CreateMuthurActionInput } from "./execution-types";

export function parseLegacyToolJson(text: string): CreateMuthurActionInput | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;

  const legacyMatch = trimmed.match(
    /^\s*\{[\s\S]*"tool"\s*:\s*"(\w+)"[\s\S]*"command"\s*:\s*"([^"]+)"[\s\S]*\}\s*$/,
  );
  if (legacyMatch) {
    return {
      type: "shell_command",
      source: "legacy_json",
      payload: { command: legacyMatch[2], tool: legacyMatch[1] },
    };
  }

  const altMatch = trimmed.match(
    /^\s*\[[\s\S]*"type"\s*:\s*"tool"[\s\S]*"name"\s*:\s*"(\w+)"[\s\S]*"arguments"\s*:\s*\{[\s\S]*"command"\s*:\s*"([^"]+)"[\s\S]*\}[^\]]*\]\s*$/,
  );
  if (altMatch) {
    return {
      type: "shell_command",
      source: "legacy_json",
      payload: { command: altMatch[2], tool: altMatch[1] },
    };
  }

  return null;
}

export function formatActionResultForChat(action: {
  type: string;
  payload: Record<string, unknown>;
  status: string;
  result?: {
    success: boolean;
    stdout?: string;
    stderr?: string;
    exit_code?: number;
    duration_ms: number;
    verification_notes?: string;
    metadata?: Record<string, unknown>;
  };
  error?: string;
}): string {
  const result = action.result;
  const lines = [
    `action: ${action.type}`,
    `status: ${action.status}`,
    `payload: ${JSON.stringify(action.payload)}`,
  ];
  if (result) {
    lines.push(`success: ${result.success}`);
    lines.push(`duration_ms: ${result.duration_ms}`);
    if (typeof result.exit_code === "number") lines.push(`exit_code: ${result.exit_code}`);
    if (result.stdout) lines.push(`stdout: ${result.stdout.slice(0, 2000)}`);
    if (result.stderr) lines.push(`stderr: ${result.stderr.slice(0, 1000)}`);
    if (result.verification_notes) lines.push(`verification_notes: ${result.verification_notes}`);
    if (result.metadata) lines.push(`metadata: ${JSON.stringify(result.metadata)}`);
  }
  if (action.error) lines.push(`error: ${action.error}`);
  return lines.join("\n");
}
