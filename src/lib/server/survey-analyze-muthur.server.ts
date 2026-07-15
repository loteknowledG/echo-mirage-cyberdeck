// SERVER ONLY — Survey vision via MUTHUR's OpenCode Zen lane (same keys/models as chat).

import { resolveServerProviderCredentials } from "@/lib/server/provider-credentials.server";
import type { SurveyAnalyzeResult } from "@/lib/server/survey-analyze.server";

const OPENCODE_ZEN_CHAT_URL = "https://opencode.ai/zen/v1/chat/completions";

function resolveMuthurVisionModel(): string {
  return (
    process.env.SURVEY_MUTHUR_MODEL?.trim() ||
    process.env.OPENCODE_MODEL?.trim() ||
    process.env.SURVEY_VISION_MODEL?.trim() ||
    "trinity-large-preview-free"
  );
}

export function isMuthurSurveyFallbackConfigured(): boolean {
  return Boolean(resolveServerProviderCredentials("opencode", undefined).apiKey);
}

async function postOpenCodeChat(input: {
  model: string;
  apiKey: string;
  messages: unknown[];
}): Promise<SurveyAnalyzeResult> {
  try {
    const res = await fetch(OPENCODE_ZEN_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: input.model,
        max_tokens: 2048,
        temperature: 0.2,
        messages: input.messages,
      }),
      signal: AbortSignal.timeout(
        Number(process.env.SURVEY_MUTHUR_TIMEOUT_MS) || 120_000,
      ),
    });

    if (!res.ok) {
      let detail = "";
      try {
        const payload = (await res.json()) as { error?: { message?: string } };
        detail = payload.error?.message ?? "";
      } catch {
        detail = await res.text().catch(() => "");
      }
      return {
        ok: false,
        error: detail || `MUTHUR (OpenCode Zen) failed (${res.status}).`,
      };
    }

    const payload = (await res.json()) as {
      choices?: Array<{
        message?: { content?: string | Array<{ type?: string; text?: string }> };
      }>;
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
      return { ok: false, error: "MUTHUR returned empty text." };
    }

    return {
      ok: true,
      text,
      model: input.model,
      provider: "muthur",
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "MUTHUR Survey analyze failed.",
    };
  }
}

/** Last-resort Survey SOLVE via MUTHUR's OpenCode Zen provider. */
export async function analyzeSurveyCaptureViaMuthur(input: {
  pngBase64: string;
  pngBase64List?: string[];
  prompt: string;
}): Promise<SurveyAnalyzeResult> {
  const { apiKey } = resolveServerProviderCredentials("opencode", undefined);
  if (!apiKey) {
    return {
      ok: false,
      error: "OPENCODE_ZEN_API_KEY not set — skip MUTHUR Survey fallback.",
    };
  }

  const list = (
    Array.isArray(input.pngBase64List) && input.pngBase64List.length > 0
      ? input.pngBase64List
      : [input.pngBase64]
  )
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (list.length === 0) {
    return { ok: false, error: "pngBase64 is required." };
  }

  const prompt = input.prompt.trim();
  if (!prompt) {
    return { ok: false, error: "prompt is required." };
  }

  const model = resolveMuthurVisionModel();
  const content: Array<Record<string, unknown>> = [{ type: "text", text: prompt }];
  for (const [index, png] of list.entries()) {
    content.push({ type: "text", text: `--- Page ${index + 1} of ${list.length} ---` });
    content.push({
      type: "image_url",
      image_url: { url: `data:image/png;base64,${png}`, detail: "high" },
    });
  }

  return postOpenCodeChat({
    model,
    apiKey,
    messages: [
      {
        role: "system",
        content:
          "You are MUTHUR assisting Survey Mirage. Answer the operator from the screenshot page(s). Be concise and actionable.",
      },
      { role: "user", content },
    ],
  });
}

export async function analyzeSurveyTextViaMuthur(input: {
  prompt: string;
}): Promise<SurveyAnalyzeResult> {
  const { apiKey } = resolveServerProviderCredentials("opencode", undefined);
  if (!apiKey) {
    return {
      ok: false,
      error: "OPENCODE_ZEN_API_KEY not set — skip MUTHUR Survey fallback.",
    };
  }

  const prompt = input.prompt.trim();
  if (!prompt) {
    return { ok: false, error: "prompt is required." };
  }

  const model = resolveMuthurVisionModel();
  return postOpenCodeChat({
    model,
    apiKey,
    messages: [
      {
        role: "system",
        content:
          "You are MUTHUR assisting Survey Mirage. Answer from the selected text. Be concise and actionable.",
      },
      { role: "user", content: prompt },
    ],
  });
}
