import { NextResponse } from "next/server";
import { analyzeSurveyCapture } from "@/lib/server/survey-analyze.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AnalyzeBody = {
  pngBase64?: string;
  prompt?: string;
  provider?: string;
  apiKey?: string;
  model?: string;
};

/** Spy Mirage — vision LLM reads a captured screenshot. */
export async function POST(request: Request) {
  let body: AnalyzeBody;
  try {
    body = (await request.json()) as AnalyzeBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const result = await analyzeSurveyCapture({
    pngBase64: body.pngBase64 ?? "",
    prompt: body.prompt,
    provider: body.provider,
    apiKey: body.apiKey,
    model: body.model,
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: 502 });
  }

  return NextResponse.json(result);
}
