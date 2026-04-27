import { NextResponse } from "next/server";

const textEncoder = new TextEncoder();

async function streamOpenAiCompatibleResponse(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  const body = response.body;

  if (!body) {
    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      },
    });
  }

  if (!contentType.includes("text/event-stream")) {
    return new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          const text = await response.text();
          if (text) controller.enqueue(textEncoder.encode(text));
        } finally {
          controller.close();
        }
      },
    });
  }

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const emit = (text: string) => {
        if (!text) return;
        controller.enqueue(textEncoder.encode(text));
      };

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() ?? "";

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line || !line.startsWith("data:")) continue;

            const data = line.slice(5).trim();
            if (data === "[DONE]") {
              controller.close();
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || "";
              emit(content);
            } catch {
              // Skip malformed JSON
            }
          }
        }
      } finally {
        controller.close();
      }
    },
  });
}

export async function POST(request: Request) {
  try {
    const { message } = await request.json();

    if (!message) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    // Get API config from env or default to opencode
    const apiKey = process.env.OPENCODE_API_KEY || "";
    const model = process.env.OPENCODE_MODEL || "trinity-large-preview-free";
    const endpoint = "https://opencode.ai/zen/v1/chat/completions";

    const providerResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "You are MU/TH/UR 6000, the AI interface of the Echo Mirage Cyberdeck. Concise, technical, helpful.",
          },
          { role: "user", content: message },
        ],
        stream: true,
      }),
    });

    if (!providerResponse.ok) {
      const text = await providerResponse.text().catch(() => "");
      return NextResponse.json(
        { error: `API error ${providerResponse.status}: ${text}` },
        { status: 502 }
      );
    }

    return new Response(await streamOpenAiCompatibleResponse(providerResponse), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("[api/cyberdeck-chat][error]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
