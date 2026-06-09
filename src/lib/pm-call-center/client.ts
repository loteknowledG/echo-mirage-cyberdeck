import type { PmCallEpisodeDigest, PmCallTurn } from "@/lib/pm-call-center/types";
import { formatPmCallTranscript } from "@/lib/pm-call-center/transcript";

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

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message =
      body && typeof body === "object" && typeof body.error === "string"
        ? body.error
        : `HTTP ${response.status}`;
    throw new Error(message);
  }

  const data = await response.json();
  return data.digest as PmCallEpisodeDigest;
}
