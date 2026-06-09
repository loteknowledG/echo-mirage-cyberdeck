import path from "node:path";
import type { CreateMuthurActionInput, MuthurActionType } from "./execution-types";

export const ALLOWED_SHELL_COMMANDS = [
  "pnpm exec tsc --noEmit",
  "pnpm build",
  "pnpm e2e",
  "pnpm lint",
  "git diff",
  "git diff --stat",
  "git status --short",
  "git log --oneline -10",
] as const;

export const WORKSPACE_ROOT = path.resolve(process.cwd());

const RUNNABLE_ACTIONS: MuthurActionType[] = [
  "shell_command",
  "read_file",
  "write_file",
  "wait",
  "open_url",
  "screenshot",
  "verify_condition",
  "verify_page_text",
  "verify_route_loaded",
  "verify_console_clean",
  "get_console_errors",
  "observe_operator_pane",
];

const ALWAYS_REQUIRES_CONFIRMATION: MuthurActionType[] = ["write_file"];

export function isPathInsideWorkspace(targetPath: string): boolean {
  const root = path.resolve(WORKSPACE_ROOT);
  const abs = path.resolve(targetPath);
  if (abs === root) return true;
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  return abs.startsWith(prefix);
}

export function isRunnableAction(type: MuthurActionType): boolean {
  return RUNNABLE_ACTIONS.includes(type);
}

export function isReadOnlyObservationAction(type: MuthurActionType): boolean {
  return type === "observe_operator_pane";
}

/** @deprecated use isRunnableAction */
export function isPhase1SupportedAction(type: MuthurActionType): boolean {
  return isRunnableAction(type);
}

export function requiresConfirmationForAction(input: CreateMuthurActionInput): boolean {
  if (input.requires_confirmation === true) return true;
  if (ALWAYS_REQUIRES_CONFIRMATION.includes(input.type)) return true;
  if (input.type === "shell_command") {
    const command = typeof input.payload.command === "string" ? input.payload.command.trim() : "";
    return !ALLOWED_SHELL_COMMANDS.includes(command as (typeof ALLOWED_SHELL_COMMANDS)[number]);
  }
  return false;
}

export function validateShellCommand(command: string): { ok: true } | { ok: false; reason: string } {
  const trimmed = command.trim();
  if (!trimmed) return { ok: false, reason: "Empty shell command." };
  if (trimmed.includes("\0")) return { ok: false, reason: "Invalid shell command." };
  if (!ALLOWED_SHELL_COMMANDS.includes(trimmed as (typeof ALLOWED_SHELL_COMMANDS)[number])) {
    return {
      ok: false,
      reason: `Command not allowlisted: ${trimmed}`,
    };
  }
  return { ok: true };
}

export function validateReadFilePath(filePath: string): { ok: true; abs: string } | { ok: false; reason: string } {
  const abs = path.resolve(filePath);
  if (!isPathInsideWorkspace(abs)) {
    return { ok: false, reason: "read_file is limited to the Echo Mirage workspace." };
  }
  return { ok: true, abs };
}

export function validateWriteFilePath(filePath: string): { ok: true; abs: string } | { ok: false; reason: string } {
  const abs = path.resolve(filePath);
  if (!isPathInsideWorkspace(abs)) {
    return { ok: false, reason: "write_file is limited to the Echo Mirage workspace." };
  }
  return { ok: true, abs };
}

const LOCALHOST_URL_PATTERN = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/i;

/** @deprecated use validateBrowserUrl from @/lib/muthur/browser/browser-policy */
export function validateOpenUrlTarget(routeOrUrl: string, baseUrl: string): { ok: true; url: string } | { ok: false; reason: string } {
  const url = /^https?:\/\//i.test(routeOrUrl)
    ? routeOrUrl
    : `${baseUrl.replace(/\/$/, "")}${routeOrUrl.startsWith("/") ? routeOrUrl : `/${routeOrUrl}`}`;
  if (!LOCALHOST_URL_PATTERN.test(url)) {
    return { ok: false, reason: "open_url is limited to localhost routes in Phase 2." };
  }
  return { ok: true, url };
}

export function validateWaitMs(raw: unknown): { ok: true; ms: number } | { ok: false; reason: string } {
  const ms = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(ms) || ms < 0) return { ok: false, reason: "wait requires a non-negative ms value." };
  if (ms > 30_000) return { ok: false, reason: "wait is capped at 30000 ms in Phase 1." };
  return { ok: true, ms: Math.floor(ms) };
}
