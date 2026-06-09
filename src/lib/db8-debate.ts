/** DB8 debate forum — topic, multi-party thread, votes, consensus. */

export type Db8DebateRole = "for" | "against" | "moderator" | "conclude";

export type Db8SpeakerId = "human" | "for" | "against" | "moderator" | "system";

export type Db8DebateEntry = {
  id: string;
  speaker: Db8SpeakerId;
  text: string;
  createdAt: number;
  votes: { agree: number; disagree: number };
};

export type Db8DebateState = {
  topic: string;
  entries: Db8DebateEntry[];
  conclusion: string;
  round: number;
};

export const DB8_DEBATE_STORAGE_KEY = "echo-mirage-db8-debate-v1";

export const DB8_SPEAKER_META: Record<
  Db8SpeakerId,
  { label: string; glyph: string; tone: string }
> = {
  human: { label: "OPERATOR", glyph: "H", tone: "text-emerald-300" },
  for: { label: "NOVA // FOR", glyph: "F", tone: "text-sky-300" },
  against: { label: "FORGE // AGAINST", glyph: "A", tone: "text-rose-300" },
  moderator: { label: "VAULT // MOD", glyph: "M", tone: "text-amber-300" },
  system: { label: "DB8", glyph: "8", tone: "text-[#8a8a8a]" },
};

export function createDb8Entry(speaker: Db8SpeakerId, text: string): Db8DebateEntry {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    speaker,
    text: text.trim(),
    createdAt: Date.now(),
    votes: { agree: 0, disagree: 0 },
  };
}

export function defaultDb8DebateState(): Db8DebateState {
  return { topic: "", entries: [], conclusion: "", round: 0 };
}

export function readDb8DebateState(): Db8DebateState {
  if (typeof window === "undefined") return defaultDb8DebateState();
  try {
    const raw = window.localStorage.getItem(DB8_DEBATE_STORAGE_KEY);
    if (!raw) return defaultDb8DebateState();
    const parsed = JSON.parse(raw) as Partial<Db8DebateState>;
    return {
      topic: typeof parsed.topic === "string" ? parsed.topic : "",
      conclusion: typeof parsed.conclusion === "string" ? parsed.conclusion : "",
      round: typeof parsed.round === "number" ? parsed.round : 0,
      entries: Array.isArray(parsed.entries)
        ? parsed.entries.filter(
            (entry): entry is Db8DebateEntry =>
              Boolean(entry) &&
              typeof entry === "object" &&
              typeof (entry as Db8DebateEntry).text === "string" &&
              typeof (entry as Db8DebateEntry).speaker === "string",
          )
        : [],
    };
  } catch {
    return defaultDb8DebateState();
  }
}

export function writeDb8DebateState(state: Db8DebateState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DB8_DEBATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function formatDb8Transcript(entries: Db8DebateEntry[]): string {
  return entries
    .map((entry) => {
      const meta = DB8_SPEAKER_META[entry.speaker];
      return `[${meta.label}] ${entry.text}`;
    })
    .join("\n\n");
}

export function db8RoleForSpeaker(speaker: Db8SpeakerId): Db8DebateRole | null {
  if (speaker === "for" || speaker === "against" || speaker === "moderator") return speaker;
  return null;
}
