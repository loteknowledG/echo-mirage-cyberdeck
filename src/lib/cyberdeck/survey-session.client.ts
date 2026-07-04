import { SURVEY_ECHO_LINK_CHANNEL } from "@/lib/cyberdeck/survey-mode";

export function broadcastSurveyEchoTerminated(sessionEpoch: number): void {
  if (typeof window === "undefined") return;
  const payload = { type: "echo-survey-terminated" as const, sessionEpoch };
  try {
    new BroadcastChannel(SURVEY_ECHO_LINK_CHANNEL).postMessage(payload);
  } catch {
    /* BroadcastChannel unavailable */
  }
  window.dispatchEvent(new CustomEvent(SURVEY_ECHO_LINK_CHANNEL, { detail: payload }));
}

export async function terminateEchoSurveySession(): Promise<
  | { ok: true; sessionEpoch: number; message: string }
  | { ok: false; reason: string }
> {
  try {
    const res = await fetch("/api/survey/echo/terminate", { method: "POST" });
    const payload = (await res.json()) as
      | { ok: true; sessionEpoch: number; message: string }
      | { ok: false; reason: string };
    if (payload.ok) {
      broadcastSurveyEchoTerminated(payload.sessionEpoch);
    }
    return payload;
  } catch {
    return { ok: false, reason: "Could not terminate Echo Survey session." };
  }
}
