import type { Drop } from "@/lib/dropbay/dropbay-types";

export type DropStreamClient = {
  enqueue: (chunk: string) => void;
  close: () => void;
};

const KEEPALIVE_MS = 20_000;

/** In-process SSE fan-out for local Drop Bay (single Node runtime). */
class DropBayStreamHub {
  private clients = new Map<DropStreamClient, ReturnType<typeof setInterval>>();

  subscribe(client: DropStreamClient): void {
    if (this.clients.has(client)) return;
    const timer = setInterval(() => {
      try {
        client.enqueue(": ping\n\n");
      } catch {
        this.unsubscribe(client);
      }
    }, KEEPALIVE_MS);
    this.clients.set(client, timer);
  }

  unsubscribe(client: DropStreamClient): void {
    const timer = this.clients.get(client);
    if (timer) clearInterval(timer);
    this.clients.delete(client);
  }

  broadcastDrop(drop: Drop): void {
    const payload = `data: ${JSON.stringify(drop)}\n\n`;
    for (const client of [...this.clients.keys()]) {
      try {
        client.enqueue(payload);
      } catch {
        this.unsubscribe(client);
      }
    }
  }
}

export const dropBayStreamHub = new DropBayStreamHub();
