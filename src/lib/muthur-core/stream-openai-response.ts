import { appendMuthurReasoningStreamDelta } from "@/lib/muthur-core/muthur-stream-reasoning";

const textEncoder = new TextEncoder();

type OpenAiStreamDelta = {
  content?: string;
  reasoning_content?: string;
  reasoning?: string;
};

function emitReasoningDelta(delta: OpenAiStreamDelta): string {
  const reasoning =
    (typeof delta.reasoning_content === "string" && delta.reasoning_content) ||
    (typeof delta.reasoning === "string" && delta.reasoning) ||
    "";
  return appendMuthurReasoningStreamDelta(reasoning);
}

/** Adapter: OpenAI SSE or raw provider body → plain text stream for the cyberdeck client. */
export async function streamOpenAiCompatibleResponse(response: Response): Promise<ReadableStream<Uint8Array>> {
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
        const reader = body.getReader();
        const decoder = new TextDecoder();
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            const text = decoder.decode(value, { stream: true });
            if (text) controller.enqueue(textEncoder.encode(text));
          }
          const rest = decoder.decode();
          if (rest) controller.enqueue(textEncoder.encode(rest));
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
      let closed = false;

      const closeOnce = () => {
        if (closed) return;
        closed = true;
        controller.close();
      };

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
              closeOnce();
              return;
            }

            try {
              const parsed = JSON.parse(data) as { choices?: { delta?: OpenAiStreamDelta }[] };
              const delta = parsed.choices?.[0]?.delta;
              if (!delta) continue;
              const reasoning = emitReasoningDelta(delta);
              if (reasoning) emit(reasoning);
              const content = delta.content || "";
              emit(content);
            } catch {
              /* skip malformed JSON */
            }
          }
        }
      } finally {
        closeOnce();
      }
    },
  });
}
