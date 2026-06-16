// SERVER ONLY — conservative Codex PTY output readiness inference (observation only).

import type { CadreRuntimeReadiness, CadreRuntimeStatus } from "@/lib/cadre/runtime-registry";

export type CodexReadinessSnapshot = {
  readiness: CadreRuntimeReadiness;
  readinessReason: string;
  lastReadinessAt: string;
};

const UPDATE_PROMPT_PATTERNS: ReadonlyArray<{ pattern: RegExp; reason: string }> = [
  { pattern: /update available/i, reason: "Codex is showing update prompt" },
  { pattern: /press enter to continue/i, reason: "Codex is waiting on update prompt acknowledgment" },
  { pattern: /skip until next version/i, reason: "Codex is showing update prompt" },
  { pattern: /update now.*npm install/i, reason: "Codex is offering CLI update" },
  { pattern: /›\s*1\.\s*update now/i, reason: "Codex is showing update menu" },
];

const AUTH_PROMPT_PATTERNS: ReadonlyArray<{ pattern: RegExp; reason: string }> = [
  { pattern: /codex login/i, reason: "Codex login is required" },
  { pattern: /run [`'"]?codex login/i, reason: "Codex login is required" },
  { pattern: /sign in to (?:openai|codex)/i, reason: "Codex sign-in is required" },
  { pattern: /not (?:logged in|authenticated)/i, reason: "Codex is not authenticated" },
  { pattern: /authentication required/i, reason: "Codex authentication is required" },
  { pattern: /please log in/i, reason: "Codex login is required" },
  { pattern: /login required/i, reason: "Codex login is required" },
];

const ERROR_PATTERNS: ReadonlyArray<{ pattern: RegExp; reason: string }> = [
  { pattern: /stdin is not a terminal/i, reason: "Codex requires a TTY terminal" },
  { pattern: /codex cli not found/i, reason: "Codex CLI is not installed" },
  { pattern: /cannot create process/i, reason: "Codex process failed to start" },
  { pattern: /attachconsole failed/i, reason: "Codex PTY attach failed" },
  { pattern: /error:\s*.+/i, reason: "Codex reported a startup error" },
  { pattern: /fatal error/i, reason: "Codex reported a fatal error" },
];

const READY_PATTERNS: ReadonlyArray<{ pattern: RegExp; reason: string }> = [
  { pattern: /type your message/i, reason: "Codex interactive prompt is available" },
  { pattern: /ask codex/i, reason: "Codex interactive prompt is available" },
  { pattern: /what would you like/i, reason: "Codex interactive prompt is available" },
  { pattern: /enter a prompt/i, reason: "Codex interactive prompt is available" },
  { pattern: /›\s*$/m, reason: "Codex selection prompt is active" },
];

function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "");
}

function normalizeOutput(stdout: string, stderr: string): string {
  return stripAnsi(`${stdout}\n${stderr}`).toLowerCase();
}

function detectBlockedUpdate(text: string): string | null {
  for (const entry of UPDATE_PROMPT_PATTERNS) {
    if (entry.pattern.test(text)) return entry.reason;
  }
  return null;
}

function detectBlockedAuth(text: string): string | null {
  for (const entry of AUTH_PROMPT_PATTERNS) {
    if (entry.pattern.test(text)) return entry.reason;
  }
  return null;
}

function detectError(text: string): string | null {
  for (const entry of ERROR_PATTERNS) {
    if (entry.pattern.test(text)) return entry.reason;
  }
  return null;
}

function detectReady(text: string, raw: string): string | null {
  if (detectBlockedUpdate(raw) || detectBlockedAuth(raw)) return null;
  for (const entry of READY_PATTERNS) {
    if (entry.pattern.test(text)) return entry.reason;
  }
  return null;
}

export function detectCodexReadiness(input: {
  stdout: string;
  stderr: string;
  status: CadreRuntimeStatus;
  exitCode?: number | null;
  signal?: string | null;
  now?: string;
}): CodexReadinessSnapshot {
  const now = input.now ?? new Date().toISOString();
  const raw = `${input.stdout}\n${input.stderr}`;
  const text = normalizeOutput(input.stdout, input.stderr);

  if (input.status === "stopped") {
    return {
      readiness: "stopped",
      readinessReason: "Codex is not running",
      lastReadinessAt: now,
    };
  }

  if (input.exitCode != null && input.exitCode !== 0) {
    return {
      readiness: "errored",
      readinessReason: `Codex exited with code ${input.exitCode}`,
      lastReadinessAt: now,
    };
  }

  if (input.signal) {
    return {
      readiness: "errored",
      readinessReason: `Codex terminated by ${input.signal}`,
      lastReadinessAt: now,
    };
  }

  const errorReason = detectError(raw) ?? detectError(text);
  if (errorReason) {
    return {
      readiness: "errored",
      readinessReason: errorReason,
      lastReadinessAt: now,
    };
  }

  const updateReason = detectBlockedUpdate(raw) ?? detectBlockedUpdate(text);
  if (updateReason) {
    return {
      readiness: "blocked_update_prompt",
      readinessReason: updateReason,
      lastReadinessAt: now,
    };
  }

  const authReason = detectBlockedAuth(raw) ?? detectBlockedAuth(text);
  if (authReason) {
    return {
      readiness: "blocked_auth",
      readinessReason: authReason,
      lastReadinessAt: now,
    };
  }

  const readyReason = detectReady(text, raw);
  if (readyReason) {
    return {
      readiness: "ready",
      readinessReason: readyReason,
      lastReadinessAt: now,
    };
  }

  if (input.status === "starting" || (input.status === "running" && text.trim().length < 40)) {
    return {
      readiness: "starting",
      readinessReason: "Codex process is starting",
      lastReadinessAt: now,
    };
  }

  return {
    readiness: "unknown",
    readinessReason: "Codex is running but readiness is not confirmed",
    lastReadinessAt: now,
  };
}

export function stoppedCodexReadiness(now = new Date().toISOString()): CodexReadinessSnapshot {
  return {
    readiness: "stopped",
    readinessReason: "Stopped by operator",
    lastReadinessAt: now,
  };
}

export function startingCodexReadiness(now = new Date().toISOString()): CodexReadinessSnapshot {
  return {
    readiness: "starting",
    readinessReason: "Spawning Codex CLI",
    lastReadinessAt: now,
  };
}
