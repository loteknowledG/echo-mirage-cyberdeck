import { NextResponse } from "next/server";
import { getModel, streamSimple, type Message } from "@mariozechner/pi-ai";
import { pmCallScenarioById } from "@/lib/pm-call-center/scenarios";
import type { PmCallEpisodeDigest, PmCallSimAction } from "@/lib/pm-call-center/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const textEncoder = new TextEncoder();

const PROVIDER_BASE_URL: Record<string, string> = {
  opencode: "https://opencode.ai/zen/v1",
  openai: "https://api.openai.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
};

const DEFAULT_PROVIDER_KEY_ENV: Record<string, string | undefined> = {
  opencode:
    process.env.OPENCODE_API_KEY ||
    process.env.ZEN_API_KEY ||
    process.env.NEXT_PUBLIC_ZEN_API_KEY,
  openai: process.env.OPENAI_API_KEY,
  openrouter: process.env.OPENROUTER_API_KEY,
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

function residentSystemPrompt(scenario: NonNullable<ReturnType<typeof pmCallScenarioById>>): string {
  return [
    "You are simulating a property management inbound caller (resident/tenant) in a TRAINING exercise.",
    "Reply with ONLY what the resident would say next — one or two short spoken sentences.",
    "No labels, no markdown, no JSON, no stage directions.",
    "Stay in character. React naturally to what the operator just said.",
    `Property context: ${scenario.propertyHint}`,
    `Character brief: ${scenario.residentBrief}`,
  ].join("\n");
}

const OBSERVER_SYSTEM_PROMPT = `You are an observer AI reviewing a property-management call-center training simulation.
Read the transcript and output ONLY valid JSON (no markdown fences) matching this schema:
{
  "scenarioId": string,
  "scenarioTitle": string,
  "category": "maintenance" | "leasing" | "emergency" | "billing" | "general",
  "residentIntent": string,
  "operatorActions": string[],
  "routing": { "department": string, "urgency": "low" | "medium" | "high" | "emergency" },
  "goodPhrases": string[],
  "escalated": boolean,
  "outcome": string,
  "lesson": string
}
Transcript may include OPERATOR_THINKING lines — private operator reasoning; weight them heavily when judging intent and routing.
Extract what the operator did well, routing/urgency you would teach from this demo, and one concise lesson for future calls.`;

function parseObserverDigest(raw: string, scenarioId: string): PmCallEpisodeDigest {
  const trimmed = raw.trim();
  const jsonStart = trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");
  const blob = jsonStart >= 0 && jsonEnd > jsonStart ? trimmed.slice(jsonStart, jsonEnd + 1) : trimmed;

  try {
    const parsed = JSON.parse(blob) as Partial<PmCallEpisodeDigest>;
    return {
      scenarioId: parsed.scenarioId || scenarioId,
      scenarioTitle: parsed.scenarioTitle || "Simulation",
      category: parsed.category || "general",
      residentIntent: parsed.residentIntent || "Unknown",
      operatorActions: Array.isArray(parsed.operatorActions) ? parsed.operatorActions.map(String) : [],
      routing: {
        department: parsed.routing?.department || "general",
        urgency: parsed.routing?.urgency || "medium",
      },
      goodPhrases: Array.isArray(parsed.goodPhrases) ? parsed.goodPhrases.map(String) : [],
      escalated: Boolean(parsed.escalated),
      outcome: parsed.outcome || "completed",
      lesson: parsed.lesson || "Review transcript manually.",
    };
  } catch {
    return {
      scenarioId,
      scenarioTitle: "Simulation",
      category: "general",
      residentIntent: "Parse failed — review transcript.",
      operatorActions: [],
      routing: { department: "general", urgency: "medium" },
      goodPhrases: [],
      escalated: false,
      outcome: "observer_parse_failed",
      lesson: trimmed.slice(0, 280) || "Observer returned non-JSON output.",
    };
  }
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
            write(`\n[CALL SIM] ${event.error.errorMessage?.trim() || "Uplink failed"}`);
            controller.close();
            return;
          }
        }
        controller.close();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Call simulation failed";
        write(`\n[CALL SIM] ${message}`);
        controller.close();
      }
    },
  });
}

function observerStream(
  scenario: NonNullable<ReturnType<typeof pmCallScenarioById>>,
  transcript: string,
  eventStream: ReturnType<typeof streamSimple>,
  provider: string,
  modelId: string,
): ReadableStream<Uint8Array> {
  const operatorLines = (transcript.match(/^OPERATOR:/gm) ?? []).length;
  const thinkingLines = (transcript.match(/^OPERATOR_THINKING:/gm) ?? []).length;
  const turnCount = (transcript.match(/^(RESIDENT|OPERATOR|SYSTEM):/gm) ?? []).length;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: Record<string, unknown>) => {
        controller.enqueue(textEncoder.encode(`${JSON.stringify(payload)}\n`));
      };

      try {
        send({
          type: "progress",
          step: "transcript",
          message: "Reading call transcript",
          detail: `${turnCount} lines · ${operatorLines} operator · ${thinkingLines} thinking notes`,
        });
        send({
          type: "progress",
          step: "model",
          message: "Connecting observer model",
          detail: `${provider} / ${modelId}`,
        });

        let raw = "";
        let composeStarted = false;
        for await (const event of eventStream) {
          if (event.type === "text_delta" && event.delta) {
            if (!composeStarted) {
              composeStarted = true;
              send({
                type: "progress",
                step: "compose",
                message: "Composing training digest",
                detail: "Analyzing intent, routing, and operator actions…",
              });
            }
            raw += event.delta;
          }
          if (event.type === "error") {
            throw new Error(event.error.errorMessage?.trim() || "Observer uplink failed");
          }
        }

        send({
          type: "progress",
          step: "parse",
          message: "Parsing observer JSON",
          detail: `${raw.length} chars received`,
        });
        const digest = parseObserverDigest(raw, scenario.id);
        send({ type: "digest", digest });
        controller.close();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Observer failed";
        send({ type: "error", message });
        controller.close();
      }
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body.action as PmCallSimAction;
    if (action !== "resident_turn" && action !== "observer_close") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const scenarioId = typeof body.scenarioId === "string" ? body.scenarioId.trim() : "";
    const scenario = pmCallScenarioById(scenarioId);
    if (!scenario) {
      return NextResponse.json({ error: "Unknown scenario" }, { status: 400 });
    }

    const transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";
    if (!transcript) {
      return NextResponse.json({ error: "Transcript required" }, { status: 400 });
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

    if (action === "resident_turn") {
      const userPrompt = [
        `Scenario: ${scenario.title} (${scenario.category})`,
        `Opening situation: ${scenario.openingLine}`,
        "\nTranscript so far:",
        transcript,
        "\nRespond as the resident with your next spoken line only.",
      ].join("\n");

      const messages: Message[] = [{ role: "user", content: userPrompt, timestamp: Date.now() }];
      const eventStream = streamSimple(
        model,
        { systemPrompt: residentSystemPrompt(scenario), messages, tools: [] },
        { apiKey },
      );

      return new Response(debateStreamToText(eventStream), {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    const observerPrompt = [
      `Scenario id: ${scenario.id}`,
      `Scenario title: ${scenario.title}`,
      `Category: ${scenario.category}`,
      "\nTranscript:",
      transcript,
      "\nProduce the observer JSON digest.",
    ].join("\n");

    const messages: Message[] = [{ role: "user", content: observerPrompt, timestamp: Date.now() }];
    const eventStream = streamSimple(
      model,
      { systemPrompt: OBSERVER_SYSTEM_PROMPT, messages, tools: [] },
      { apiKey },
    );

    return new Response(observerStream(scenario, transcript, eventStream, provider, modelId), {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[api/pm-call-sim][error]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
