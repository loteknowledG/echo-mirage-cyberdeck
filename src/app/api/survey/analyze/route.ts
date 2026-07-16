import { NextResponse } from "next/server";
import { isLocalhostRequest } from "@/lib/server/is-localhost-request.server";
import {
  analyzeSurveyCapture,
  DEFAULT_SURVEY_MULTI_PAGE_PROMPT,
  DEFAULT_SURVEY_PROMPT,
} from "@/lib/server/survey-analyze.server";
import { resolveServerProviderCredentials } from "@/lib/server/provider-credentials.server";
import {
  createSurveyRelayCommandRequest,
  loadSurveyRelayCommandRequest,
  loadSurveyRelayCommandResult,
  resolveSurveyRelayBundle,
} from "@/lib/server/survey-cloud-relay.server";

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

type RelaySolveInput = {
  prompt?: string;
  pngBase64?: string;
  pngBase64List?: string[];
};

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function runRelayCodexSolve(
  input: RelaySolveInput,
): Promise<{ ok: boolean; text?: string; model?: string; provider?: string; error?: string }> {
  const relay = await resolveSurveyRelayBundle(null);
  if (!relay) {
    return {
      ok: false,
      error: "No active Echo relay bundle — keep Echo Satellite open, then retry SOLVE.",
    };
  }

  const command = await createSurveyRelayCommandRequest({
    echoNodeId: relay.bundle.echoNodeId,
    action: "echo.solve-codex",
    payload: {
      prompt: input.prompt,
      pngBase64: input.pngBase64,
      pngBase64List: input.pngBase64List,
    },
  });

  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const result = await loadSurveyRelayCommandResult(command.requestId);
    if (result) {
      if (!result.ok) {
        return { ok: false, error: result.reason ?? "Echo Codex solve failed." };
      }
      if (!result.answerText?.trim()) {
        return { ok: false, error: "Echo Codex returned empty text." };
      }
      return {
        ok: true,
        text: result.answerText.trim(),
        model: result.model ?? "codex-subscription",
        provider: result.provider ?? "codex-relay",
      };
    }
    const pending = await loadSurveyRelayCommandRequest(command.requestId);
    if (!pending || pending.status !== "pending") {
      break;
    }
    await sleep(1200);
  }
  return {
    ok: false,
    error:
      "Echo did not answer relay Codex solve in time. Keep Echo Satellite open with codex login, then retry.",
  };
}

function hasRemoteAnalyzeCredentials(body: AnalyzeBody): boolean {
  if (body.apiKey?.trim()) return true;
  if (resolveServerProviderCredentials("openai", undefined).apiKey) return true;
  if (resolveServerProviderCredentials("openrouter", undefined).apiKey) return true;
  if (resolveServerProviderCredentials("opencode", undefined).apiKey) return true;
  return false;
}

function normalizePngList(body: AnalyzeBody): string[] {
  return Array.isArray(body.pngBase64List)
    ? body.pngBase64List.map((entry) => String(entry ?? "").trim()).filter(Boolean)
    : [];
}

function hasRelaySolvePayload(body: AnalyzeBody, pngList: string[]): boolean {
  return (
    pngList.length > 0 ||
    Boolean(body.pngBase64?.trim()) ||
    Boolean(body.selectionText?.trim())
  );
}

function resolveRelayPrompt(body: AnalyzeBody, pageCount: number): string {
  const custom = body.prompt?.trim();
  if (custom) return custom;
  if (body.selectionText?.trim()) {
    return body.prompt?.trim() || "Answer the selected text clearly and concisely.";
  }
  return pageCount > 1 ? DEFAULT_SURVEY_MULTI_PAGE_PROMPT : DEFAULT_SURVEY_PROMPT;
}

function buildRelaySolveInput(body: AnalyzeBody, pngList: string[]): RelaySolveInput {
  const selectionText = body.selectionText?.trim();
  const prompt = resolveRelayPrompt(body, pngList.length);
  if (selectionText && pngList.length === 0 && !body.pngBase64?.trim()) {
    return {
      prompt: `${prompt}\n\n---\n\n${selectionText}`,
    };
  }
  return {
    prompt,
    pngBase64: body.pngBase64,
    pngBase64List: pngList.length > 0 ? pngList : undefined,
  };
}

/** Survey Mirage — vision analyze for captured screenshots (Codex CLI or API key). */
export async function POST(request: Request) {
  let body: AnalyzeBody;
  try {
    body = (await request.json()) as AnalyzeBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const list = normalizePngList(body);
  const hosted = !isLocalhostRequest(request);
  const hasCredentials = hasRemoteAnalyzeCredentials(body);
  const relayBundle = hosted ? await resolveSurveyRelayBundle(null) : null;
  const relayAvailable = Boolean(relayBundle);
  const canRelaySolve = hasRelaySolvePayload(body, list);

  if (hosted && !hasCredentials && !relayAvailable) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "SOLVE needs Echo Satellite online (codex login on that Mac) or a CAPTURE gateway key (OpenAI / OpenRouter / OpenCode Zen).",
      },
      { status: 403 },
    );
  }

  if (hosted && !hasCredentials && relayAvailable && canRelaySolve) {
    const relaySolve = await runRelayCodexSolve(buildRelaySolveInput(body, list));
    if (relaySolve.ok) {
      return NextResponse.json({
        ok: true,
        text: relaySolve.text,
        model: relaySolve.model,
        provider: relaySolve.provider,
      });
    }
    return NextResponse.json({ ok: false, error: relaySolve.error }, { status: 502 });
  }

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

  if (!result.ok && hosted && relayAvailable && canRelaySolve) {
    const relaySolve = await runRelayCodexSolve(buildRelaySolveInput(body, list));
    if (relaySolve.ok) {
      return NextResponse.json({
        ok: true,
        text: relaySolve.text,
        model: relaySolve.model,
        provider: relaySolve.provider,
      });
    }
    return NextResponse.json(
      { ok: false, error: `${result.error} · codex-relay: ${relaySolve.error}` },
      { status: 502 },
    );
  }

  if (!result.ok) {
    return NextResponse.json(result, { status: 502 });
  }

  return NextResponse.json(result);
}
