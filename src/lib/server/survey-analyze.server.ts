// SERVER ONLY — vision analysis for Survey captures.

import { resolveServerProviderCredentials } from "@/lib/server/provider-credentials.server";

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

const DEFAULT_SURVEY_PROMPT =
  "Describe what is on this screen. If it shows a coding interview question or LeetCode-style problem, summarize the problem statement and constraints clearly.";

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

export type SpyAnalyzeInput = {
  pngBase64: string;
  prompt?: string;
  provider?: string;
  apiKey?: string;
  model?: string;
};

export type SpyAnalyzeResult =
  | { ok: true; text: string; model: string; provider: string }
  | { ok: false; error: string };

export async function analyzeSurveyCapture(input: SpyAnalyzeInput): Promise<SpyAnalyzeResult> {
  const pngBase64 = input.pngBase64.trim();
  if (!pngBase64) {
    return { ok: false, error: "pngBase64 is required." };
  }

  const provider = input.provider?.trim() || "openai";
  const endpoint = resolveChatEndpoint(provider);
  if (!endpoint) {
    return { ok: false, error: `Provider "${provider}" does not support Survey vision yet. Use openai or openrouter.` };
  }

  const { apiKey } = resolveServerProviderCredentials(provider, input.apiKey);
  if (!apiKey) {
    return { ok: false, error: `No API key for ${provider}. Add credentials in Settings.` };
  }

  const model = input.model?.trim() || resolveVisionModel(provider);
  const prompt = input.prompt?.trim() || DEFAULT_SURVEY_PROMPT;
  const imageUrl = `data:image/png;base64,${pngBase64}`;

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
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
            ],
          },
        ],
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
    const content = payload.choices?.[0]?.message?.content;
    let text = "";
    if (typeof content === "string") {
      text = content.trim();
    } else if (Array.isArray(content)) {
      text = content
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
