/** OpenAI-compatible upstream request headers (never include secrets in logs). */
export function buildProviderUpstreamHeaders(
  providerId: string,
  apiKey: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  if (providerId === "openrouter") {
    const referer =
      process.env.OPENROUTER_HTTP_REFERER?.trim() ||
      process.env.VERCEL_URL?.trim() ||
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      "https://echo-mirage-cyberdeck.vercel.app";
    const title =
      process.env.OPENROUTER_APP_TITLE?.trim() || "Echo Mirage Cyberdeck";
    headers["HTTP-Referer"] = referer.startsWith("http") ? referer : `https://${referer}`;
    headers["X-Title"] = title;
  }

  return headers;
}

/** Catch obvious provider/model mismatches before uplink (e.g. OpenRouter model on OpenCode). */
export function detectProviderModelMismatch(
  providerId: string,
  model: string,
): string | null {
  const id = model.trim().toLowerCase();
  if (!id) return "Model id is empty.";

  if (providerId === "opencode" || providerId === "opencode-go") {
    const looksOpenRouter =
      id.includes("/") || id.includes(":free") || id.startsWith("nvidia/") || id.startsWith("openai/");
    if (looksOpenRouter) {
      return `Model "${model}" belongs on OpenRouter — switch gateway provider to OpenRouter or pick an OpenCode model (e.g. trinity-large-preview-free).`;
    }
  }

  if (providerId === "openrouter") {
    if (id === "trinity-large-preview-free" || id.startsWith("trinity-")) {
      return `Model "${model}" is an OpenCode model — switch gateway provider to OpenCode or pick an OpenRouter model id.`;
    }
  }

  return null;
}
