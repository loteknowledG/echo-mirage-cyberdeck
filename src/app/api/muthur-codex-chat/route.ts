import { NextResponse } from "next/server";
import { isLocalhostRequest } from "@/lib/server/is-localhost-request.server";
import { analyzeSurveyTextViaCodex } from "@/lib/server/survey-analyze-codex.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CodexChatBody = {
  message?: string;
  history?: Array<{ role?: string; content?: string }>;
};

function buildCodexChatPrompt(message: string, history: CodexChatBody["history"]): string {
  const lines = (history ?? [])
    .map((entry) => {
      const content = entry.content?.trim();
      if (!content) return null;
      const speaker = entry.role === "assistant" ? "Assistant" : "Operator";
      return `${speaker}: ${content}`;
    })
    .filter((line): line is string => Boolean(line));

  if (lines.length === 0) {
    return message;
  }

  return [
    "Conversation so far:",
    ...lines,
    "",
    `Operator: ${message}`,
    "",
    "Respond directly as Codex — technical, concise, and interview-ready.",
  ].join("\n");
}

/** MUTHUR pane Codex inhabitant — text chat via logged-in Codex CLI. */
export async function POST(request: Request) {
  if (!isLocalhostRequest(request)) {
    return NextResponse.json({ ok: false, error: "Localhost only." }, { status: 403 });
  }

  let body: CodexChatBody;
  try {
    body = (await request.json()) as CodexChatBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const message = body.message?.trim();
  if (!message) {
    return NextResponse.json({ ok: false, error: "message is required." }, { status: 400 });
  }

  const result = await analyzeSurveyTextViaCodex({
    prompt: buildCodexChatPrompt(message, body.history),
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error ?? "Codex exec failed." }, { status: 502 });
  }

  return NextResponse.json({ ok: true, text: result.text, provider: result.provider, model: result.model });
}
