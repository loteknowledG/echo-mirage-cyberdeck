// SERVER ONLY — cadre terminal output SSE hub.

export type CadreStreamEvent =
  | { type: "ready" }
  | { type: "output"; runtimeId: string; stream: "stdout" | "stderr"; line: string }
  | {
      type: "status";
      runtimeId: string;
      status: string;
      pid: number | null;
      readiness?: string;
      readinessReason?: string;
      lastReadinessAt?: string | null;
    };

type CadreStreamClient = {
  enqueue: (chunk: string) => void;
  close: () => void;
};

class CadreStreamHub {
  private clients = new Set<CadreStreamClient>();

  subscribe(client: CadreStreamClient): void {
    this.clients.add(client);
  }

  unsubscribe(client: CadreStreamClient): void {
    this.clients.delete(client);
  }

  publish(event: CadreStreamEvent): void {
    const payload = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
    for (const client of this.clients) {
      client.enqueue(payload);
    }
  }
}

export const cadreStreamHub = new CadreStreamHub();
