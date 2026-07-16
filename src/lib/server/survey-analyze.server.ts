// SERVER ONLY — vision analysis for Survey captures.
// Auto chain: Codex → OpenAI/OpenRouter → Cursor → MUTHUR (OpenCode Zen).

import { SURVEY_SELECTED_TEXT_PROMPT } from "@/lib/cyberdeck/powerfist-mission.types";
import { isCodexCliAvailable } from "@/lib/server/cadre/adapters/codex-runtime-adapter.server";
import { resolveServerProviderCredentials } from "@/lib/server/provider-credentials.server";
import {
  analyzeSurveyCaptureViaCodex,
  analyzeSurveyTextViaCodex,
} from "@/lib/server/survey-analyze-codex.server";
import {
  analyzeSurveyCaptureViaCursor,
  analyzeSurveyTextViaCursor,
} from "@/lib/server/survey-analyze-cursor.server";
import {
  analyzeSurveyCaptureViaMuthur,
  analyzeSurveyTextViaMuthur,
} from "@/lib/server/survey-analyze-muthur.server";
import { surveyCaptureDataUrl } from "@/lib/cyberdeck/survey-capture-mime";

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

export const DEFAULT_SURVEY_PROMPT =
  "Describe what is on this screen. If it shows a coding interview question or LeetCode-style problem, summarize the problem statement and constraints clearly.";

export const DEFAULT_SURVEY_MULTI_PAGE_PROMPT =
  "These screenshots are consecutive pages of one question or problem (page 1 first). Read every page in order, reconstruct the full problem, then solve it. Be concise and actionable.";

function normalizePngList(input: SurveyAnalyzeInput): string[] {
  const fromList = Array.isArray(input.pngBase64List)
    ? input.pngBase64List.map((entry) => String(entry ?? "").trim()).filter(Boolean)
    : [];
  if (fromList.length > 0) return fromList.slice(0, 6);
  const single = input.pngBase64?.trim();
  return single ? [single] : [];
}

function resolveCapturePrompt(input: SurveyAnalyzeInput, pageCount: number): string {
  const custom = input.prompt?.trim();
  if (custom) return custom;
  return pageCount > 1 ? DEFAULT_SURVEY_MULTI_PAGE_PROMPT : DEFAULT_SURVEY_PROMPT;
}

type SurveyVisionProvider =
  | "auto"
  | "codex"
  | "openai"
  | "openrouter"
  | "cursor"
  | "muthur";

function resolveVisionProvider(input: SurveyAnalyzeInput): SurveyVisionProvider {
  const raw = input.provider?.trim().toLowerCase();
  if (
    raw === "codex" ||
    raw === "openai" ||
    raw === "openrouter" ||
    raw === "cursor" ||
    raw === "muthur"
  ) {
    return raw;
  }
  return "auto";
}

function listApiVisionFallbacks(): Array<"openai" | "openrouter"> {
  const providers: Array<"openai" | "openrouter"> = [];
  if (resolveServerProviderCredentials("openai", undefined).apiKey) {
    providers.push("openai");
  }
  if (resolveServerProviderCredentials("openrouter", undefined).apiKey) {
    providers.push("openrouter");
  }
  return providers;
}

function resolveVisionModel(provider: string): string {
  const fromEnv = process.env.SURVEY_VISION_MODEL?.trim();
  if (fromEnv) return fromEnv;
  if (provider === "openrouter") return "openai/gpt-4o";
  return "gpt-4o";
}

function resolveChatEndpoint(provider: string): string | null {
  if (provider === "openai") return OPENAI_CHAT_URL;
  if (provider === "openrouter") return OPENROUTER_CHAT_URL;
  return null;
}

export type SurveyAnalyzeInput = {
  pngBase64?: string;
  /** Ordered multi-page captures (page 1 first). */
  pngBase64List?: string[];
  selectionText?: string;
  prompt?: string;
  provider?: string;
  apiKey?: string;
  model?: string;
};

export type SurveyAnalyzeResult =
  | { ok: true; text: string; model: string; provider: string }
  | { ok: false; error: string };

async function analyzeSurveyCaptureViaApi(
  input: SurveyAnalyzeInput,
  provider: "openai" | "openrouter",
  pngList: string[],
): Promise<SurveyAnalyzeResult> {
  const endpoint = resolveChatEndpoint(provider);
  if (!endpoint) {
    return {
      ok: false,
      error: `Provider "${provider}" does not support Survey vision yet.`,
    };
  }

  const { apiKey } = resolveServerProviderCredentials(provider, input.apiKey);
  if (!apiKey) {
    return { ok: false, error: `No API key for ${provider}.` };
  }

  const model = input.model?.trim() || resolveVisionModel(provider);
  const prompt = resolveCapturePrompt(input, pngList.length);
  const content: Array<Record<string, unknown>> = [{ type: "text", text: prompt }];
  for (const [index, png] of pngList.entries()) {
    content.push({
      type: "text",
      text: `--- Page ${index + 1} of ${pngList.length} ---`,
    });
    content.push({
      type: "image_url",
      image_url: { url: surveyCaptureDataUrl(png), detail: "high" },
    });
  }

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        temperature: 0.2,
        messages: [{ role: "user", content }],
      }),
    });

    if (!res.ok) {
      let detail = "";
      try {
        const payload = (await res.json()) as { error?: { message?: string } };
        detail = payload.error?.message ?? "";
      } catch {
        detail = await res.text().catch(() => "");
      }
      return { ok: false, error: detail || `Vision API failed (${res.status}).` };
    }

    const payload = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
    };
    const messageContent = payload.choices?.[0]?.message?.content;
    let text = "";
    if (typeof messageContent === "string") {
      text = messageContent.trim();
    } else if (Array.isArray(messageContent)) {
      text = messageContent
        .map((part) => (part.type === "text" ? part.text ?? "" : ""))
        .join("")
        .trim();
    }

    if (!text) {
      return { ok: false, error: "Vision model returned empty text." };
    }

    return { ok: true, text, model, provider };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Vision request failed.",
    };
  }
}

async function analyzeSurveySelectionViaApi(
  input: SurveyAnalyzeInput,
  provider: "openai" | "openrouter",
  prompt: string,
): Promise<SurveyAnalyzeResult> {
  const endpoint = resolveChatEndpoint(provider);
  if (!endpoint) {
    return {
      ok: false,
      error: `Provider "${provider}" does not support Survey text analyze yet.`,
    };
  }

  const { apiKey } = resolveServerProviderCredentials(provider, input.apiKey);
  if (!apiKey) {
    return { ok: false, error: `No API key for ${provider}.` };
  }

  const model = input.model?.trim() || (provider === "openrouter" ? "openai/gpt-4o" : "gpt-4o");

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        temperature: 0.2,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      let detail = "";
      try {
        const payload = (await res.json()) as { error?: { message?: string } };
        detail = payload.error?.message ?? "";
      } catch {
        detail = await res.text().catch(() => "");
      }
      return { ok: false, error: detail || `Text API failed (${res.status}).` };
    }

    const payload = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = payload.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) {
      return { ok: false, error: "Text model returned empty response." };
    }

    return { ok: true, text, model, provider };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Text request failed.",
    };
  }
}

async function runAutoCaptureChain(
  input: SurveyAnalyzeInput,
  pngList: string[],
  prompt: string,
): Promise<SurveyAnalyzeResult> {
  const errors: string[] = [];
  const primary = pngList[0] ?? "";

  if (isCodexCliAvailable()) {
    const result = await analyzeSurveyCaptureViaCodex({
      pngBase64: primary,
      pngBase64List: pngList,
      prompt,
    });
    if (result.ok) return result;
    errors.push(`codex: ${result.error}`);
  }

  for (const fallback of listApiVisionFallbacks()) {
    const result = await analyzeSurveyCaptureViaApi(input, fallback, pngList);
    if (result.ok) return result;
    errors.push(`${fallback}: ${result.error}`);
  }

  const cursorResult = await analyzeSurveyCaptureViaCursor({
    pngBase64: primary,
    pngBase64List: pngList,
    prompt,
  });
  if (cursorResult.ok) return cursorResult;
  errors.push(`cursor: ${cursorResult.error}`);

  const muthurResult = await analyzeSurveyCaptureViaMuthur({
    pngBase64: primary,
    pngBase64List: pngList,
    prompt,
    apiKey: input.apiKey,
    model: input.model,
  });
  if (muthurResult.ok) return muthurResult;
  errors.push(`muthur: ${muthurResult.error}`);

  return {
    ok: false,
    error: `Survey analyze exhausted fallbacks. ${errors.join(" · ")}`,
  };
}

async function runAutoSelectionChain(
  input: SurveyAnalyzeInput,
  prompt: string,
): Promise<SurveyAnalyzeResult> {
  const errors: string[] = [];

  if (isCodexCliAvailable()) {
    const result = await analyzeSurveyTextViaCodex({ prompt });
    if (result.ok) return result;
    errors.push(`codex: ${result.error}`);
  }

  for (const fallback of listApiVisionFallbacks()) {
    const result = await analyzeSurveySelectionViaApi(input, fallback, prompt);
    if (result.ok) return result;
    errors.push(`${fallback}: ${result.error}`);
  }

  const cursorResult = await analyzeSurveyTextViaCursor({ prompt });
  if (cursorResult.ok) return cursorResult;
  errors.push(`cursor: ${cursorResult.error}`);

  const muthurResult = await analyzeSurveyTextViaMuthur({
    prompt,
    apiKey: input.apiKey,
    model: input.model,
  });
  if (muthurResult.ok) return muthurResult;
  errors.push(`muthur: ${muthurResult.error}`);

  return {
    ok: false,
    error: `Survey text analyze exhausted fallbacks. ${errors.join(" · ")}`,
  };
}

async function analyzeSurveySelection(
  input: SurveyAnalyzeInput,
  selectionText: string,
): Promise<SurveyAnalyzeResult> {
  const instruction = input.prompt?.trim() || SURVEY_SELECTED_TEXT_PROMPT;
  const prompt = `${instruction}\n\n---\n\n${selectionText}`;
  const requested = resolveVisionProvider(input);

  if (requested === "auto") {
    return runAutoSelectionChain(input, prompt);
  }

  switch (requested) {
    case "codex":
      return analyzeSurveyTextViaCodex({ prompt });
    case "cursor":
      return analyzeSurveyTextViaCursor({ prompt });
    case "muthur":
      return analyzeSurveyTextViaMuthur({
        prompt,
        apiKey: input.apiKey,
        model: input.model,
      });
    case "openai":
    case "openrouter":
      return analyzeSurveySelectionViaApi(input, requested, prompt);
    default: {
      const _exhaustive: never = requested;
      return { ok: false, error: `Unknown provider: ${String(_exhaustive)}` };
    }
  }
}

export async function analyzeSurveyCapture(input: SurveyAnalyzeInput): Promise<SurveyAnalyzeResult> {
  const selectionText = input.selectionText?.trim();
  if (selectionText) {
    return analyzeSurveySelection(input, selectionText);
  }

  const pngList = normalizePngList(input);
  if (pngList.length === 0) {
    return { ok: false, error: "pngBase64, pngBase64List, or selectionText is required." };
  }

  const prompt = resolveCapturePrompt(input, pngList.length);
  const requested = resolveVisionProvider(input);
  const primary = pngList[0] ?? "";

  if (requested === "auto") {
    return runAutoCaptureChain(input, pngList, prompt);
  }

  switch (requested) {
    case "codex":
      return analyzeSurveyCaptureViaCodex({
        pngBase64: primary,
        pngBase64List: pngList,
        prompt,
      });
    case "cursor":
      return analyzeSurveyCaptureViaCursor({
        pngBase64: primary,
        pngBase64List: pngList,
        prompt,
      });
    case "muthur":
      return analyzeSurveyCaptureViaMuthur({
        pngBase64: primary,
        pngBase64List: pngList,
        prompt,
        apiKey: input.apiKey,
        model: input.model,
      });
    case "openai":
    case "openrouter":
      return analyzeSurveyCaptureViaApi(input, requested, pngList);
    default: {
      const _exhaustive: never = requested;
      return { ok: false, error: `Unknown provider: ${String(_exhaustive)}` };
    }
  }
}
