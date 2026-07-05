import { NextResponse } from "next/server";
import { isLocalhostRequest } from "@/lib/server/is-localhost-request.server";
import { analyzeSurveyCapture } from "@/lib/server/survey-analyze.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AnalyzeBody = {
  pngBase64?: string;
  selectionText?: string;
  prompt?: string;
  provider?: string;
  apiKey?: string;
  model?: string;
};

/** Survey Mirage — vision analyze for captured screenshots (Codex CLI or API key). */
export async function POST(request: Request) {
  if (!isLocalhostRequest(request)) {
    return NextResponse.json({ ok: false, error: "Localhost only." }, { status: 403 });
  }

  let body: AnalyzeBody;
  try {
    body = (await request.json()) as AnalyzeBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const result = await analyzeSurveyCapture({
    pngBase64: body.pngBase64,
    selectionText: body.selectionText,
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
