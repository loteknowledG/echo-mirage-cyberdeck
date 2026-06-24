import { readOpenCodeZenApiKeyFromEnv } from "@/lib/opencode-provider-env";
import { NextResponse } from "next/server";
import { getModel, streamSimple, type Message } from "@mariozechner/pi-ai";
import type { Db8DebateRole } from "@/lib/db8-debate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const textEncoder = new TextEncoder();

const PROVIDER_BASE_URL: Record<string, string> = {
  opencode: "https://opencode.ai/zen/v1",
  openai: "https://api.openai.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
};

const DEFAULT_PROVIDER_KEY_ENV: Record<string, string | undefined> = {
  opencode: readOpenCodeZenApiKeyFromEnv() || undefined,
  openai: process.env.OPENAI_API_KEY,
  openrouter: process.env.OPENROUTER_API_KEY,
};

const ROLE_PROMPTS: Record<Db8DebateRole, string> = {
  for:
    "You are NOVA (FOR) in DB8, a structured debate chamber. Argue clearly FOR the proposition. " +
    "Be concise (2–4 short paragraphs). Address the strongest counterpoint. No preamble.",
  against:
    "You are FORGE (AGAINST) in DB8. Argue clearly AGAINST the proposition. " +
    "Be concise (2–4 short paragraphs). Steel-man the other side, then refute. No preamble.",
  moderator:
    "You are VAULT (MODERATOR) in DB8. Stay neutral. Summarize the live disagreement, " +
    "name what would change minds, and ask one precise question to both sides. Max 2 paragraphs.",
  conclude:
    "You are DB8 consensus synthesizer. Read the full debate and vote tally. " +
    "State the adopted conclusion, residual dissent, and one recommended next action. Be decisive.",
};

function resolveProviderApiKey(provider: string, suppliedApiKey: unknown): string {
  if (typeof suppliedApiKey === "string" && suppliedApiKey.trim()) {
    return suppliedApiKey.trim();
  }
  const envKey = DEFAULT_PROVIDER_KEY_ENV[provider];
  return typeof envKey === "string" ? envKey.trim() : "";
}

function resolveModel(provider: string, modelId: string) {
  const known = getModel(provider as "opencode", modelId as "big-pickle");
  if (known) return known;

  const baseUrl = PROVIDER_BASE_URL[provider];
  if (!baseUrl) return null;

  return {
    id: modelId,
    name: modelId,
    api: "openai-completions",
    provider,
    baseUrl,
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128_000,
    maxTokens: 8_192,
  } as ReturnType<typeof getModel>;
}

function debateStreamToText(eventStream: ReturnType<typeof streamSimple>): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (text: string) => {
        if (text) controller.enqueue(textEncoder.encode(text));
      };
      try {
        for await (const event of eventStream) {
          if (event.type === "text_delta" && event.delta) write(event.delta);
          if (event.type === "error") {
            write(`\n[DB8] ${event.error.errorMessage?.trim() || "Debate uplink failed"}`);
            controller.close();
            return;
          }
        }
        controller.close();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Debate uplink failed";
        write(`\n[DB8] ${message}`);
        controller.close();
      }
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const role = body.role as Db8DebateRole;
    if (!role || !(role in ROLE_PROMPTS)) {
      return NextResponse.json({ error: "Invalid debate role" }, { status: 400 });
    }

    const topic = typeof body.topic === "string" ? body.topic.trim() : "";
    if (!topic) {
      return NextResponse.json({ error: "Debate topic required" }, { status: 400 });
    }

    const provider = typeof body.provider === "string" ? body.provider : "opencode";
    const modelId =
      typeof body.model === "string" && body.model.trim()
        ? body.model.trim()
        : process.env.OPENCODE_MODEL || "big-pickle";

    const model = resolveModel(provider, modelId);
    if (!model) {
      return NextResponse.json({ error: `Unsupported provider: ${provider}` }, { status: 400 });
    }

    const apiKey = resolveProviderApiKey(provider, body.apiKey);
    if (!apiKey) {
      return NextResponse.json({ error: "API key required" }, { status: 401 });
    }

    const transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";
    const voteSummary = typeof body.voteSummary === "string" ? body.voteSummary.trim() : "";

    const userPrompt = [
      `Proposition: ${topic}`,
      transcript ? `\nDebate so far:\n${transcript}` : "\nDebate so far: (opening round)",
      voteSummary ? `\nVote tally:\n${voteSummary}` : "",
      role === "conclude"
        ? "\nDeliver the room's conclusion."
        : `\nYour turn as ${role.toUpperCase()}.`,
    ]
      .filter(Boolean)
      .join("\n");

    const messages: Message[] = [{ role: "user", content: userPrompt, timestamp: Date.now() }];

    const eventStream = streamSimple(
      model,
      { systemPrompt: ROLE_PROMPTS[role], messages, tools: [] },
      { apiKey },
    );

    return new Response(debateStreamToText(eventStream), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[api/db8-debate][error]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
