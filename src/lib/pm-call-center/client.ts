import type {
  PmCallEpisodeDigest,
  PmCallObserverProgressEvent,
  PmCallTurn,
} from "@/lib/pm-call-center/types";
import { formatPmCallTranscript } from "@/lib/pm-call-center/transcript";

async function readNdjsonStream<T>(
  response: Response,
  onLine?: (line: Record<string, unknown>) => T | void,
): Promise<T> {
  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await response.json().catch(() => null);
      const message =
        body && typeof body === "object" && typeof body.error === "string"
          ? body.error
          : `HTTP ${response.status}`;
      throw new Error(message);
    }
    throw new Error(`HTTP ${response.status}`);
  }

  if (!response.body) {
    throw new Error("Observer stream missing body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: T | undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const parsed = JSON.parse(line) as Record<string, unknown>;
      if (parsed.type === "error" && typeof parsed.message === "string") {
        throw new Error(parsed.message);
      }
      const maybe = onLine?.(parsed);
      if (maybe !== undefined) result = maybe;
    }
  }

  const tail = buffer.trim();
  if (tail) {
    const parsed = JSON.parse(tail) as Record<string, unknown>;
    if (parsed.type === "error" && typeof parsed.message === "string") {
      throw new Error(parsed.message);
    }
    const maybe = onLine?.(parsed);
    if (maybe !== undefined) result = maybe;
  }

  if (result === undefined) {
    throw new Error("Observer stream ended without a digest");
  }
  return result;
}

async function readPlainTextStream(response: Response): Promise<string> {
  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await response.json().catch(() => null);
      const message =
        body && typeof body === "object" && typeof body.error === "string"
          ? body.error
          : `HTTP ${response.status}`;
      throw new Error(message);
    }
    throw new Error(`HTTP ${response.status}`);
  }

  if (!response.body) {
    return (await response.text()).trim();
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

export async function fetchPmCallResidentTurn(opts: {
  scenarioId: string;
  turns: PmCallTurn[];
  provider: string;
  model: string;
  apiKey: string;
  signal?: AbortSignal;
}): Promise<string> {
  const response = await fetch("/api/pm-call-sim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: opts.signal,
    body: JSON.stringify({
      action: "resident_turn",
      scenarioId: opts.scenarioId,
      transcript: formatPmCallTranscript(opts.turns),
      provider: opts.provider,
      model: opts.model,
      apiKey: opts.apiKey,
    }),
  });
  return (await readPlainTextStream(response)).trim();
}

export async function fetchPmCallObserverDigest(opts: {
  scenarioId: string;
  turns: PmCallTurn[];
  provider: string;
  model: string;
  apiKey: string;
  signal?: AbortSignal;
  onProgress?: (event: PmCallObserverProgressEvent) => void;
}): Promise<PmCallEpisodeDigest> {
  const response = await fetch("/api/pm-call-sim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: opts.signal,
    body: JSON.stringify({
      action: "observer_close",
      scenarioId: opts.scenarioId,
      transcript: formatPmCallTranscript(opts.turns),
      provider: opts.provider,
      model: opts.model,
      apiKey: opts.apiKey,
    }),
  });

  return readNdjsonStream<PmCallEpisodeDigest>(response, (line) => {
    if (line.type === "progress") {
      opts.onProgress?.({
        type: "progress",
        step: String(line.step ?? "step"),
        message: String(line.message ?? "Working…"),
        detail: typeof line.detail === "string" ? line.detail : undefined,
      });
      return;
    }
    if (line.type === "digest" && line.digest && typeof line.digest === "object") {
      return line.digest as PmCallEpisodeDigest;
    }
  });
}
