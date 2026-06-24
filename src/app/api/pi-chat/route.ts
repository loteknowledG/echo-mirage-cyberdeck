import { readOpenCodeZenApiKeyFromEnv } from "@/lib/opencode-provider-env";
import { NextResponse } from "next/server";
import { getModel, streamSimple, type Message, type Model } from "@mariozechner/pi-ai";
import { runPiChatWithComputerUseTools } from "@/lib/pi/pi-chat-with-tools.server";
import { PI_COMPUTER_USE_DOCTRINE } from "@/lib/pi/pi-computer-use-doctrine";
import { buildPiGlyphContextPrompt, PI_GLYPH_DOCTRINE } from "@/lib/pi/pi-glyph-doctrine";

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

function resolveProviderApiKey(provider: string, suppliedApiKey: unknown): string {
  if (typeof suppliedApiKey === "string" && suppliedApiKey.trim()) {
    return suppliedApiKey.trim();
  }
  const envKey = DEFAULT_PROVIDER_KEY_ENV[provider];
  if (typeof envKey === "string" && envKey.trim()) {
    return envKey.trim();
  }
  return "";
}

function resolvePiModel(provider: string, modelId: string): Model<string> | null {
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
  } as Model<string>;
}

function formatPiUplinkError(raw: string): string {
  const trimmed = raw.trim();
  const jsonStart = trimmed.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(trimmed.slice(jsonStart)) as {
        error?: { message?: string };
        message?: string;
      };
      const inner = parsed.error?.message || parsed.message;
      if (typeof inner === "string" && inner.trim()) return inner.trim();
    } catch {
      /* keep raw */
    }
  }
  return trimmed.replace(/^\d{3}\s*/, "") || "Pi uplink failed";
}

function piStreamToPlainText(
  eventStream: ReturnType<typeof streamSimple>,
): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (text: string) => {
        if (text) controller.enqueue(textEncoder.encode(text));
      };

      try {
        for await (const event of eventStream) {
          if (event.type === "text_delta" && event.delta) {
            write(event.delta);
            continue;
          }
          if (event.type === "error") {
            const message = formatPiUplinkError(
              event.error.errorMessage?.trim() || "Pi uplink failed",
            );
            write(`\n[Pi] ${message}`);
            controller.close();
            return;
          }
        }
        controller.close();
      } catch (error) {
        const message = formatPiUplinkError(
          error instanceof Error ? error.message : "Pi uplink failed",
        );
        write(`\n[Pi] ${message}`);
        controller.close();
      }
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const provider = typeof body.provider === "string" ? body.provider : "opencode";
    const modelId =
      typeof body.model === "string" && body.model.trim() ? body.model.trim() : "big-pickle";

    console.debug("[api/pi-chat] incoming", {
      provider,
      model: modelId,
      messageCount: Array.isArray(body.messages) ? body.messages.length : 0,
    });

    const model = resolvePiModel(provider, modelId);
    if (!model) {
      return NextResponse.json({ error: `Unsupported provider: ${provider}` }, { status: 400 });
    }

    const apiKey = resolveProviderApiKey(provider, body.apiKey);
    if (!apiKey) {
      return NextResponse.json({ error: "API key required" }, { status: 401 });
    }

    const baseSystemPrompt = typeof body.systemPrompt === "string" ? body.systemPrompt : "";
    const muthurScreenContext =
      typeof body.muthurScreenContext === "string" ? body.muthurScreenContext.trim() : "";
    const glyphContext = typeof body.glyphContext === "string" ? body.glyphContext : "";
    const computerUseEnabled = body.computerUseEnabled !== false;
    const systemPrompt = [
      baseSystemPrompt.trim(),
      muthurScreenContext,
      PI_GLYPH_DOCTRINE,
      buildPiGlyphContextPrompt(glyphContext),
      computerUseEnabled ? PI_COMPUTER_USE_DOCTRINE : "",
      computerUseEnabled
        ? "\nWhen executing desktop missions (not glyph channel art), call pi_computer_use repeatedly: screenshot first, then act. Report each receipt."
        : "",
    ]
      .filter(Boolean)
      .join("\n");
    const messages = Array.isArray(body.messages) ? (body.messages as Message[]) : [];

    if (computerUseEnabled) {
      return new Response(
        new ReadableStream<Uint8Array>({
          async start(controller) {
            const write = (text: string) => {
              if (text) controller.enqueue(textEncoder.encode(text));
            };
            try {
              await runPiChatWithComputerUseTools({
                model,
                systemPrompt: systemPrompt || undefined,
                messages,
                streamOptions: { apiKey },
                write,
              });
              controller.close();
            } catch (error) {
              const message = formatPiUplinkError(
                error instanceof Error ? error.message : "Pi uplink failed",
              );
              write(`\n[Pi] ${message}`);
              controller.close();
            }
          },
        }),
        {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          },
        },
      );
    }

    const eventStream = streamSimple(
      model,
      {
        systemPrompt: systemPrompt || undefined,
        messages,
        tools: [],
      },
      { apiKey },
    );

    console.debug("[api/pi-chat] upstream", { provider, model: modelId, api: model.api });

    return new Response(piStreamToPlainText(eventStream), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[api/pi-chat][error]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
