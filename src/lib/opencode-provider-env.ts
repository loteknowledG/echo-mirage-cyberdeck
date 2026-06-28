/**
 * OpenCode credential env vars (server-side only — never use NEXT_PUBLIC_* for these).
 *
 * - OPENCODE_ZEN_API_KEY — Zen pay-as-you-go → https://opencode.ai/zen/v1 (Echo Mirage OPENCODE gateway)
 * - OPENCODE_GO_API_KEY  — Go subscription   → https://opencode.ai/zen/go/v1 (gateway lane reserved)
 */

export const OPENCODE_ZEN_API_KEY_ENV = "OPENCODE_ZEN_API_KEY" as const;
export const OPENCODE_GO_API_KEY_ENV = "OPENCODE_GO_API_KEY" as const;

/** Legacy Vercel/demo names still accepted for Zen lane. */
const OPENCODE_ZEN_LEGACY_ENVS = ["OPENCODE_API_KEY", "ZEN_API_KEY"] as const;

export function readOpenCodeZenApiKeyFromEnv(): string {
  const primary = process.env[OPENCODE_ZEN_API_KEY_ENV]?.trim();
  if (primary) return primary;
  for (const key of OPENCODE_ZEN_LEGACY_ENVS) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}

export function readOpenCodeGoApiKeyFromEnv(): string {
  return process.env[OPENCODE_GO_API_KEY_ENV]?.trim() ?? "";
}

export function openCodeZenConfiguredInEnv(): boolean {
  return readOpenCodeZenApiKeyFromEnv().length > 0;
}

export function openCodeGoConfiguredInEnv(): boolean {
  return readOpenCodeGoApiKeyFromEnv().length > 0;
}
