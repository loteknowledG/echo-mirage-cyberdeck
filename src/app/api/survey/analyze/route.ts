import { NextResponse } from "next/server";
import { isLocalhostRequest } from "@/lib/server/is-localhost-request.server";
import { analyzeSurveyCapture } from "@/lib/server/survey-analyze.server";
import { resolveServerProviderCredentials } from "@/lib/server/provider-credentials.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AnalyzeBody = {
  pngBase64?: string;
  /** Ordered pages for multi-screen questions (preferred over single pngBase64). */
  pngBase64List?: string[];
  selectionText?: string;
  prompt?: string;
  provider?: string;
  gatewayProvider?: "opencode" | "openrouter" | "openai";
  apiKey?: string;
  model?: string;
};

function hasRemoteAnalyzeCredentials(body: AnalyzeBody): boolean {
  if (body.apiKey?.trim()) return true;
  if (resolveServerProviderCredentials("openai", undefined).apiKey) return true;
  if (resolveServerProviderCredentials("openrouter", undefined).apiKey) return true;
  if (resolveServerProviderCredentials("opencode", undefined).apiKey) return true;
  return false;
}

/** Survey Mirage — vision analyze for captured screenshots (Codex CLI or API key). */
export async function POST(request: Request) {
  let body: AnalyzeBody;
  try {
    body = (await request.json()) as AnalyzeBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  // Localhost: Codex/Cursor CLIs OK. Hosted PWA: require a gateway key (client or server env).
  if (!isLocalhostRequest(request) && !hasRemoteAnalyzeCredentials(body)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "ANALYZE needs a gateway key on the hosted PWA — save OpenAI / OpenRouter / OpenCode Zen under CAPTURE, then SOLVE again.",
      },
      { status: 403 },
    );
  }

  const list = Array.isArray(body.pngBase64List)
    ? body.pngBase64List.map((entry) => String(entry ?? "").trim()).filter(Boolean)
    : [];

  const result = await analyzeSurveyCapture({
    pngBase64: body.pngBase64,
    pngBase64List: list.length > 0 ? list : undefined,
    selectionText: body.selectionText,
    prompt: body.prompt,
    provider: body.provider,
    gatewayProvider: body.gatewayProvider,
    apiKey: body.apiKey,
    model: body.model,
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: 502 });
  }

  return NextResponse.json(result);
}
