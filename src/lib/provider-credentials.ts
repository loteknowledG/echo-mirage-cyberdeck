/** Client-safe provider credential helpers. Never logs secrets. */

export type ClientCredentialSource = "ui_saved_key" | "session_key" | "none";

export type OutboundProviderCredentials = {
  apiKey: string;
  credentialSource: ClientCredentialSource;
};

export const CLIENT_BAKED_PROVIDER_KEYS: Record<string, string> = {
  opencode:
    (process.env.NEXT_PUBLIC_OPENCODE_API_KEY ||
      process.env.NEXT_PUBLIC_ZEN_API_KEY ||
      "").trim(),
  openrouter: (process.env.NEXT_PUBLIC_OPENROUTER_API_KEY || "").trim(),
  openai: (process.env.NEXT_PUBLIC_OPENAI_API_KEY || "").trim(),
};

/** Resolve outbound API key for models/chat — same priority on client before server env fallback. */
export function resolveOutboundProviderCredentials(
  provider: string,
  providerKeys: Record<string, string>,
): OutboundProviderCredentials {
  const saved = providerKeys[provider]?.trim();
  if (saved) {
    return { apiKey: saved, credentialSource: "ui_saved_key" };
  }
  const baked = CLIENT_BAKED_PROVIDER_KEYS[provider]?.trim();
  if (baked) {
    return { apiKey: baked, credentialSource: "session_key" };
  }
  return { apiKey: "", credentialSource: "none" };
}

export function providerHasUsableCredentials(
  providerId: string,
  providerKeys: Record<string, string>,
  defaultKeyAvailableByProvider: Record<string, boolean>,
): boolean {
  const outbound = resolveOutboundProviderCredentials(providerId, providerKeys);
  return Boolean(outbound.apiKey || defaultKeyAvailableByProvider[providerId]);
}

export type ProviderConnectionLabel =
  | "CONNECTED"
  | "AUTH FAILED"
  | "NO KEY"
  | "QUOTA"
  | "UNAVAILABLE"
  | "LINKING";

export function resolveProviderConnectionLabel(args: {
  hasAuth: boolean;
  rateLimited: boolean;
  fetchStatus: "idle" | "retrieving" | "invalid-key" | "error" | "ready";
}): ProviderConnectionLabel {
  if (!args.hasAuth) return "NO KEY";
  if (args.rateLimited) return "QUOTA";
  if (args.fetchStatus === "retrieving") return "LINKING";
  if (args.fetchStatus === "invalid-key") return "AUTH FAILED";
  if (args.fetchStatus === "error") return "UNAVAILABLE";
  if (args.fetchStatus === "ready") return "CONNECTED";
  return "NO KEY";
}

export function formatProviderReceiptDiagnostic(receipt: {
  provider: string;
  model?: string;
  credential_source: string;
  auth: string;
  reason?: string;
}): string {
  const parts = [
    "[PROVIDER RECEIPT]",
    `provider=${receipt.provider}`,
    receipt.model ? `model=${receipt.model}` : null,
    `credential_source=${receipt.credential_source}`,
    `auth=${receipt.auth}`,
    receipt.reason ? `reason=${receipt.reason}` : null,
  ].filter(Boolean);
  return parts.join("\n");
}
