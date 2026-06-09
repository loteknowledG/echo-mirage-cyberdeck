import { pmCallScenarioById } from "@/lib/pm-call-center/scenarios";
import type {
  PmCallEpisode,
  PmCallEpisodeDigest,
  PmCallSimPhase,
  PmCallSimSession,
  PmCallTurn,
} from "@/lib/pm-call-center/types";

export const PM_CALL_EPISODES_STORAGE_KEY = "echo-mirage-pm-call-episodes-v1";
export const PM_CALL_SESSION_STORAGE_KEY = "echo-mirage-pm-call-session-v1";
const MAX_EPISODES = 40;

export function readPmCallEpisodes(): PmCallEpisode[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PM_CALL_EPISODES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as PmCallEpisode[];
  } catch {
    return [];
  }
}

export function writePmCallEpisodes(episodes: PmCallEpisode[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      PM_CALL_EPISODES_STORAGE_KEY,
      JSON.stringify(episodes.slice(0, MAX_EPISODES)),
    );
  } catch {
    /* ignore */
  }
}

export function appendPmCallEpisode(episode: PmCallEpisode): PmCallEpisode[] {
  const next = [episode, ...readPmCallEpisodes()].slice(0, MAX_EPISODES);
  writePmCallEpisodes(next);
  return next;
}

function isPmCallTurn(value: unknown): value is PmCallTurn {
  if (!value || typeof value !== "object") return false;
  const turn = value as PmCallTurn;
  return (
    (turn.role === "resident" || turn.role === "operator" || turn.role === "system") &&
    typeof turn.text === "string" &&
    typeof turn.id === "string"
  );
}

function isPmCallDigest(value: unknown): value is PmCallEpisodeDigest {
  if (!value || typeof value !== "object") return false;
  const digest = value as PmCallEpisodeDigest;
  return typeof digest.residentIntent === "string" && typeof digest.lesson === "string";
}

function normalizePhase(phase: unknown): PmCallSimPhase | null {
  if (phase === "live" || phase === "hung_up" || phase === "review") return phase;
  if (phase === "observing") return "hung_up";
  return null;
}

export function readPmCallSimSession(): PmCallSimSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PM_CALL_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PmCallSimSession>;
    const phase = normalizePhase(parsed.phase);
    const scenarioId = typeof parsed.scenarioId === "string" ? parsed.scenarioId.trim() : "";
    if (!phase || !scenarioId || !pmCallScenarioById(scenarioId)) return null;

    const turns = Array.isArray(parsed.turns)
      ? parsed.turns.filter(isPmCallTurn)
      : [];
    if (turns.length === 0) return null;

    return {
      schemaVersion: 1,
      phase,
      scenarioId,
      turns,
      composer: typeof parsed.composer === "string" ? parsed.composer : "",
      operatorNotesDraft:
        typeof parsed.operatorNotesDraft === "string" ? parsed.operatorNotesDraft : "",
      digest: parsed.digest && isPmCallDigest(parsed.digest) ? parsed.digest : null,
      status:
        typeof parsed.status === "string" && parsed.status.trim()
          ? parsed.status.trim()
          : "Session restored.",
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function writePmCallSimSession(session: PmCallSimSession | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!session) {
      window.localStorage.removeItem(PM_CALL_SESSION_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(PM_CALL_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* ignore */
  }
}

export function clearPmCallSimSession(): void {
  writePmCallSimSession(null);
}
