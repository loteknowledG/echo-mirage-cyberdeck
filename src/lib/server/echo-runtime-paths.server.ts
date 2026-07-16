// SERVER ONLY — writable temp/state dir for Next (packaged Electron cannot write under Program Files).

import fs from "node:fs";
import path from "node:path";

/**
 * Prefer ECHO_MIRAGE_TMP_DIR (set by Electron packaged-server), then Vercel /tmp,
 * otherwise repo-local `.tmp` for `pnpm dev`.
 */
export function resolveEchoTmpDir(): string {
  const fromEnv = process.env.ECHO_MIRAGE_TMP_DIR?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.VERCEL) return "/tmp";
  return path.join(process.cwd(), ".tmp");
}

export function resolveEchoTmpPath(...parts: string[]): string {
  return path.join(resolveEchoTmpDir(), ...parts);
}

/** Ensure the echo tmp root exists before writing state files. */
export function ensureEchoTmpDir(): string {
  const dir = resolveEchoTmpDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
