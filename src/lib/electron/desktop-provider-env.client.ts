"use client";

/** Persist gateway keys into Electron userData so the Next server sees them on restart. */
export async function persistDesktopProviderEnv(vars: Record<string, string>): Promise<void> {
  if (typeof window === "undefined") return;
  const bridge = window.echoMirageProviderEnv;
  if (!bridge?.write) return;
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(vars)) {
    const trimmed = value?.trim();
    if (trimmed) cleaned[key] = trimmed;
  }
  if (Object.keys(cleaned).length === 0) return;
  try {
    await bridge.write(cleaned);
  } catch {
    /* best-effort — UI localStorage still works for the current session */
  }
}

export function gatewayProviderToEnvKey(
  provider: "opencode" | "openrouter" | "openai",
): string {
  switch (provider) {
    case "opencode":
      return "OPENCODE_ZEN_API_KEY";
    case "openrouter":
      return "OPENROUTER_API_KEY";
    case "openai":
      return "OPENAI_API_KEY";
    default: {
      const exhaustive: never = provider;
      return exhaustive;
    }
  }
}
