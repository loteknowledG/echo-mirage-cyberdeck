"use client";

import {
  gatewayProviderToEnvKey,
  persistDesktopProviderEnv,
} from "@/lib/electron/desktop-provider-env.client";

export type SurveyAnalyzeClientResult =
  | { ok: true; text: string; model: string; provider: string }
  | { ok: false; error: string };

export type SurveyGatewayProvider = "opencode" | "openrouter" | "openai";

type SurveyClientCredentials = {
  gatewayProvider: SurveyGatewayProvider;
  provider: "muthur" | "openrouter" | "openai";
  apiKey: string;
  model?: string;
};

const SURVEY_GATEWAY_PROVIDERS: SurveyGatewayProvider[] = [
  "openrouter",
  "openai",
  "opencode",
];

function toSurveyProvider(
  provider: SurveyGatewayProvider,
): SurveyClientCredentials["provider"] {
  return provider === "opencode" ? "muthur" : provider;
}

/** Map saved gateway key → vision analyze provider (OpenCode uses MUTHUR lane). */
export function resolveSurveyAnalyzeProvider(
  creds: SurveyClientCredentials | null,
  fallback = "auto",
): string {
  if (!creds) return fallback;
  return creds.provider;
}

export function readSurveyGatewayCredentials(): SurveyClientCredentials | null {
  if (typeof window === "undefined") return null;

  const storedActive = window.localStorage.getItem("active_provider");
  const active = SURVEY_GATEWAY_PROVIDERS.includes(
    storedActive as SurveyGatewayProvider,
  )
    ? (storedActive as SurveyGatewayProvider)
    : "opencode";
  const ordered = [
    active,
    ...SURVEY_GATEWAY_PROVIDERS.filter((provider) => provider !== active),
  ];

  for (const provider of ordered) {
    const apiKey = window.localStorage.getItem(`key_${provider}`)?.trim() ?? "";
    if (!apiKey) continue;
    const model =
      window.localStorage.getItem(`ascii_model_${provider}`)?.trim() || undefined;
    return {
      gatewayProvider: provider,
      provider: toSurveyProvider(provider),
      apiKey,
      model,
    };
  }

  return null;
}

export function saveSurveyGatewayCredentials(
  provider: SurveyGatewayProvider,
  apiKey: string,
): void {
  if (typeof window === "undefined") return;
  const trimmed = apiKey.trim();
  if (!trimmed) return;
  window.localStorage.setItem("active_provider", provider);
  window.localStorage.setItem(`key_${provider}`, trimmed);
  void persistDesktopProviderEnv({
    [gatewayProviderToEnvKey(provider)]: trimmed,
  });
}

export function surveyImageDataUrlToBase64(imageDataUrl: string): string {
  const trimmed = imageDataUrl.trim();
  const comma = trimmed.indexOf(",");
  return comma >= 0 ? trimmed.slice(comma + 1) : trimmed;
}

/** Vision analyze via `/api/survey/analyze` — defaults to Codex CLI when no API key. */
export async function analyzeSurveyCaptureClient(input: {
  pngBase64?: string;
  pngBase64List?: string[];
  prompt?: string;
  provider?: string;
}): Promise<SurveyAnalyzeClientResult> {
  return analyzeSurveyRequestClient({
    pngBase64: input.pngBase64,
    pngBase64List: input.pngBase64List,
    prompt: input.prompt,
    provider: input.provider,
  });
}

/** Text-only analyze for Echo selected text — Codex or API key. */
export async function analyzeSurveySelectionClient(input: {
  selectionText: string;
  prompt?: string;
  provider?: string;
}): Promise<SurveyAnalyzeClientResult> {
  return analyzeSurveyRequestClient({
    selectionText: input.selectionText,
    prompt: input.prompt,
    provider: input.provider,
  });
}

async function analyzeSurveyRequestClient(input: {
  pngBase64?: string;
  pngBase64List?: string[];
  selectionText?: string;
  prompt?: string;
  provider?: string;
}): Promise<SurveyAnalyzeClientResult> {
  const savedCredentials =
    !input.provider || input.provider === "auto"
      ? readSurveyGatewayCredentials()
      : null;

  const res = await fetch("/api/survey/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pngBase64: input.pngBase64,
      pngBase64List: input.pngBase64List,
      selectionText: input.selectionText,
      prompt: input.prompt,
      provider: resolveSurveyAnalyzeProvider(savedCredentials, input.provider ?? "auto"),
      gatewayProvider: savedCredentials?.gatewayProvider,
      apiKey: savedCredentials?.apiKey,
      model: savedCredentials?.model,
    }),
  });

  let payload: SurveyAnalyzeClientResult;
  try {
    payload = (await res.json()) as SurveyAnalyzeClientResult;
  } catch {
    return { ok: false, error: `Analyze request failed (${res.status}).` };
  }

  if (!payload.ok) {
    return payload;
  }

  return payload;
}
