import { dropBayStreamHub } from "@/lib/dropbay/dropbay-stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const encoder = new TextEncoder();
  let client: { enqueue: (chunk: string) => void; close: () => void } | null = null;
  let closed = false;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    if (client) dropBayStreamHub.unsubscribe(client);
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      client = {
        enqueue(chunk: string) {
          if (closed) return;
          controller.enqueue(encoder.encode(chunk));
        },
        close() {
          if (closed) return;
          closed = true;
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        },
      };

      dropBayStreamHub.subscribe(client);
      client.enqueue("event: ready\ndata: {}\n\n");
    },
    cancel() {
      cleanup();
    },
  });

  request.signal.addEventListener("abort", cleanup, { once: true });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
