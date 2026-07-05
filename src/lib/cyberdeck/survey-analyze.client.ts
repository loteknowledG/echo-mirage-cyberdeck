"use client";

export type SurveyAnalyzeClientResult =
  | { ok: true; text: string; model: string; provider: string }
  | { ok: false; error: string };

export function surveyImageDataUrlToBase64(imageDataUrl: string): string {
  const trimmed = imageDataUrl.trim();
  const comma = trimmed.indexOf(",");
  return comma >= 0 ? trimmed.slice(comma + 1) : trimmed;
}

/** Vision analyze via `/api/survey/analyze` — defaults to Codex CLI when no API key. */
export async function analyzeSurveyCaptureClient(input: {
  pngBase64: string;
  prompt?: string;
  provider?: string;
}): Promise<SurveyAnalyzeClientResult> {
  const res = await fetch("/api/survey/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pngBase64: input.pngBase64,
      prompt: input.prompt,
      provider: input.provider ?? "auto",
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
