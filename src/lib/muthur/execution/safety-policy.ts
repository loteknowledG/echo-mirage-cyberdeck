import path from "node:path";

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

export function isPathInsideWorkspace(targetPath: string): boolean {
  const root = path.resolve(WORKSPACE_ROOT);
  const abs = path.resolve(targetPath);
  if (abs === root) return true;
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  return abs.startsWith(prefix);
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
