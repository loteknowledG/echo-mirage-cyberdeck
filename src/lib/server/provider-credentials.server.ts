import {
  OPENCODE_GO_API_KEY_ENV,
  OPENCODE_ZEN_API_KEY_ENV,
  openCodeGoConfiguredInEnv,
  openCodeZenConfiguredInEnv,
} from "@/lib/opencode-provider-env";

// SERVER ONLY: provider credential resolution. Never log or return secrets.

export type ProviderCredentialSource =
  | "env"
  | "ui_saved_key"
  | "session_key"
  | "provider_override"
  | "none";

export type ProviderAuthResult = "success" | "failed" | "pending";

export type ProviderAuthFailureReason =
  | "no_key"
  | "invalid_api_key"
  | "quota_exceeded"
  | "model_unavailable"
  | "model_mismatch"
  | "provider_timeout"
  | "provider_unavailable"
  | "unknown";

export type ProviderReceipt = {
  provider: string;
  model?: string;
  credential_source: ProviderCredentialSource;
  auth: ProviderAuthResult;
  reason?: ProviderAuthFailureReason;
  models_available?: number;
};

const PROVIDER_PRIVATE_ENV: Record<string, string[]> = {
  opencode: [OPENCODE_ZEN_API_KEY_ENV, "OPENCODE_API_KEY", "ZEN_API_KEY"],
  "opencode-go": [OPENCODE_GO_API_KEY_ENV],
  openai: ["OPENAI_API_KEY"],
  openrouter: ["OPENROUTER_API_KEY"],
};

/** Gateway providers that share unified credential resolution. */
export const GATEWAY_PROVIDER_IDS = ["opencode", "openrouter", "openai"] as const;

export type GatewayProviderId = (typeof GATEWAY_PROVIDER_IDS)[number];

const PROVIDER_PUBLIC_ENV: Record<string, string[]> = {
  openai: ["NEXT_PUBLIC_OPENAI_API_KEY"],
  openrouter: ["NEXT_PUBLIC_OPENROUTER_API_KEY"],
};

export const MODEL_LIST_URL: Record<string, string> = {
  opencode: "https://opencode.ai/zen/v1/models",
  openai: "https://api.openai.com/v1/models",
  openrouter: "https://openrouter.ai/api/v1/models",
};

function readEnv(keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}

function envCredentialCandidates(provider: string): Array<{
  apiKey: string;
  credentialSource: ProviderCredentialSource;
}> {
  const out: Array<{ apiKey: string; credentialSource: ProviderCredentialSource }> = [];
  const priv = readEnv(PROVIDER_PRIVATE_ENV[provider] ?? []);
  if (priv) out.push({ apiKey: priv, credentialSource: "env" });
  const pub = readEnv(PROVIDER_PUBLIC_ENV[provider] ?? []);
  if (pub && pub !== priv) out.push({ apiKey: pub, credentialSource: "session_key" });
  return out;
}

/** True when server env (private or public) supplies a key — no upstream probe. */
export function providerServerConfigured(provider: string): boolean {
  return envCredentialCandidates(provider).length > 0;
}

export function listServerConfiguredProviders(): Record<GatewayProviderId, boolean> & {
  opencodeZen: boolean;
  opencodeGo: boolean;
} {
  return {
    opencode: openCodeZenConfiguredInEnv(),
    opencodeZen: openCodeZenConfiguredInEnv(),
    opencodeGo: openCodeGoConfiguredInEnv(),
    openrouter: providerServerConfigured("openrouter"),
    openai: providerServerConfigured("openai"),
  };
}

export function resolveServerProviderCredentials(
  provider: string,
  suppliedApiKey: unknown,
  options?: { override?: boolean },
): { apiKey: string; credentialSource: ProviderCredentialSource } {
  const supplied = typeof suppliedApiKey === "string" ? suppliedApiKey.trim() : "";
  const candidates = envCredentialCandidates(provider);

  if (options?.override && supplied) {
    return { apiKey: supplied, credentialSource: "provider_override" };
  }

  if (supplied) {
    const envMatch = candidates.find((entry) => entry.apiKey === supplied);
    if (envMatch) return envMatch;
    return { apiKey: supplied, credentialSource: "ui_saved_key" };
  }

  const first = candidates[0];
  if (first) return first;
  return { apiKey: "", credentialSource: "none" };
}

export function classifyProviderAuthFailure(
  status: number,
  rawBody = "",
): ProviderAuthFailureReason {
  const lower = rawBody.toLowerCase();
  if (status === 401 || status === 403 || lower.includes("invalid api key") || lower.includes("incorrect api key")) {
    return "invalid_api_key";
  }
  if (status === 429 || lower.includes("rate limit") || lower.includes("quota")) {
    return "quota_exceeded";
  }
  if (status === 408 || lower.includes("timed out") || lower.includes("timeout")) {
    return "provider_timeout";
  }
  if (status === 404 || lower.includes("model not found") || lower.includes("no endpoints")) {
    return "model_unavailable";
  }
  if (status === 502 || status === 503 || status === 0) {
    return "provider_unavailable";
  }
  return "unknown";
}

export function buildProviderReceipt(args: {
  provider: string;
  model?: string;
  credentialSource: ProviderCredentialSource;
  auth: ProviderAuthResult;
  reason?: ProviderAuthFailureReason;
  modelsAvailable?: number;
}): ProviderReceipt {
  return {
    provider: args.provider,
    model: args.model,
    credential_source: args.credentialSource,
    auth: args.auth,
    reason: args.reason,
    models_available: args.modelsAvailable,
  };
}

export function formatProviderReceiptHeader(receipt: ProviderReceipt): string {
  return JSON.stringify(receipt);
}

export function formatProviderReceiptText(receipt: ProviderReceipt): string {
  const lines = [
    "[PROVIDER RECEIPT]",
    `provider=${receipt.provider}`,
    receipt.model ? `model=${receipt.model}` : null,
    `credential_source=${receipt.credential_source}`,
    `auth=${receipt.auth}`,
    receipt.reason ? `reason=${receipt.reason}` : null,
    receipt.models_available != null ? `models_available=${receipt.models_available}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

export function providerResponseHeaders(receipt: ProviderReceipt): Record<string, string> {
  return {
    "X-Muthur-Provider-Receipt": formatProviderReceiptHeader(receipt),
  };
}
