import { cadreStreamHub } from "@/lib/server/cadre-stream-hub.server";
import { getCadreRuntimeManager } from "@/lib/server/cadre-runtime-manager.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const runtimeId = url.searchParams.get("runtimeId")?.trim() ?? "";
  const manager = getCadreRuntimeManager();
  const encoder = new TextEncoder();
  let client: { enqueue: (chunk: string) => void; close: () => void } | null = null;
  let closed = false;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    if (client) cadreStreamHub.unsubscribe(client);
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

      cadreStreamHub.subscribe(client);
      client.enqueue(`event: ready\ndata: ${JSON.stringify({ type: "ready" })}\n\n`);

      const runtimes = manager.listRuntimes().filter((entry) => !runtimeId || entry.id === runtimeId);
      for (const runtime of runtimes) {
        const output = manager.getOutput(runtime.id);
        if (!output) continue;
        client.enqueue(
          `event: snapshot\ndata: ${JSON.stringify({
            type: "snapshot",
            runtimeId: runtime.id,
            status: output.status,
            stdout: output.stdout,
            stderr: output.stderr,
          })}\n\n`,
        );
      }
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
