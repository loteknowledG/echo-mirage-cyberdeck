"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CyberdeckPaneHeader,
  CyberdeckPaneHeaderSubtitle,
  CyberdeckPaneHeaderTitle,
  CyberdeckPaneHeaderValue,
} from "@/components/cyberdeck/pane-header";
import { CyberdeckActionButton } from "@/components/cyberdeck/action-button";
import { cn } from "@/lib/utils";
import {
  createDb8Entry,
  db8RoleForSpeaker,
  DB8_SPEAKER_META,
  defaultDb8DebateState,
  formatDb8Transcript,
  readDb8DebateState,
  writeDb8DebateState,
  type Db8DebateEntry,
  type Db8DebateRole,
  type Db8DebateState,
  type Db8SpeakerId,
} from "@/lib/db8-debate";
import {
  Db8VoiceQueue,
  type Db8DeckSpeakLine,
  operatorPropositionSpeech,
  readDb8VoiceEnabled,
  unlockDb8Audio,
  writeDb8VoiceEnabled,
} from "@/lib/db8-voice";
import { Switch } from "@/components/ui/switch";

type Db8PaneBodyProps = {
  onSpeakLine?: Db8DeckSpeakLine;
  activeProvider?: string;
  modelId?: string;
  apiKey?: string;
};

type Db8NoticeKind = "idle" | "info" | "progress" | "voice" | "success" | "error";

type Db8Notice = {
  id: string;
  text: string;
  kind: Db8NoticeKind;
  at: number;
};

const DB8_NOTICE_LIMIT = 12;

function noticeKindStyles(kind: Db8NoticeKind): string {
  switch (kind) {
    case "progress":
      return "border-amber-500/35 bg-amber-500/8 text-amber-200";
    case "voice":
      return "border-sky-500/35 bg-sky-500/8 text-sky-200";
    case "success":
      return "border-emerald-500/35 bg-emerald-500/8 text-emerald-200";
    case "error":
      return "border-rose-500/35 bg-rose-500/8 text-rose-200";
    case "info":
      return "border-[#2d2d2d] bg-black/70 text-[#b8b8b8]";
    default:
      return "border-[#1c1c1c] bg-black/60 text-[#8a8a8a]";
  }
}

function formatNoticeTime(at: number): string {
  return new Date(at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function Db8SpeakerChips({
  activeSpeaker,
  busy,
  speaking,
  compact,
}: {
  activeSpeaker: Db8SpeakerId | "conclude" | null;
  busy: boolean;
  speaking: boolean;
  compact?: boolean;
}) {
  const speakers: Db8SpeakerId[] = ["human", "for", "against", "moderator"];
  return (
    <div className={cn("grid grid-cols-4 gap-1 font-mono tracking-[0.08em]", compact ? "text-[8px]" : "text-[9px]")}>
      {speakers.map((speaker) => {
        const active = activeSpeaker === speaker && (busy || speaking);
        const meta = DB8_SPEAKER_META[speaker];
        return (
          <div
            key={speaker}
            className={cn(
              "truncate rounded border px-1.5 py-1 text-center transition-colors",
              speaker === "human" ? "border-emerald-500/20" : "border-[#1c1c1c]",
              active && "border-amber-500/45 bg-amber-500/10",
              !active && speaker === "human" && "bg-black/60",
              !active && speaker !== "human" && "bg-black/60",
            )}
          >
            <span className={meta.tone}>{meta.glyph}</span>
            {!compact ? <span className="ml-1 opacity-80">{meta.label.split(" // ")[0]}</span> : null}
          </div>
        );
      })}
    </div>
  );
}

function Db8StatusPanel({
  status,
  statusKind,
  busy,
  speaking,
  round,
  topic,
  notices,
  activityOpen,
  onToggleActivity,
}: {
  status: string;
  statusKind: Db8NoticeKind;
  busy: boolean;
  speaking: boolean;
  round: number;
  topic: string;
  notices: Db8Notice[];
  activityOpen: boolean;
  onToggleActivity: () => void;
}) {
  const phaseLabel = speaking ? "SPEAKING" : busy ? "IN PROGRESS" : statusKind === "error" ? "ATTENTION" : "STATUS";

  return (
    <div className="shrink-0 space-y-1">
      <div
        className={cn(
          "rounded-sm border px-2.5 py-2 transition-colors",
          noticeKindStyles(speaking ? "voice" : busy ? "progress" : statusKind),
          (busy || speaking) && "animate-pulse",
        )}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[9px] tracking-[0.14em] opacity-80">{phaseLabel}</span>
          <span className="font-mono text-[9px] tracking-[0.1em] opacity-70">
            {topic ? `ROUND ${round}` : "NO SESSION"}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-2 font-mono text-[10px] leading-snug tracking-[0.04em]">{status}</p>
      </div>

      {notices.length > 0 ? (
        <div className="rounded-sm border border-[#1c1c1c] bg-black/55 px-2 py-1.5">
          <button
            type="button"
            onClick={onToggleActivity}
            className="flex w-full items-center justify-between font-mono text-[8px] tracking-[0.14em] text-[#606060] hover:text-[#909090]"
          >
            <span>ACTIVITY ({notices.length})</span>
            <span>{activityOpen ? "▾" : "▸"}</span>
          </button>
          {activityOpen ? (
            <ul className="custom-scrollbar mt-1 max-h-20 space-y-0.5 overflow-y-auto">
              {notices.map((notice) => (
                <li
                  key={notice.id}
                  className="flex items-start gap-2 font-mono text-[8px] leading-snug tracking-[0.04em] text-[#909090]"
                >
                  <span className="shrink-0 text-[#585858]">{formatNoticeTime(notice.at)}</span>
                  <span
                    className={cn(
                      "line-clamp-2",
                      notice.kind === "error" && "text-rose-300/90",
                      notice.kind === "success" && "text-emerald-300/90",
                      notice.kind === "voice" && "text-sky-300/90",
                      notice.kind === "progress" && "text-amber-200/90",
                    )}
                  >
                    {notice.text}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

async function readPlainTextStream(response: Response): Promise<string> {
  if (!response.ok || !response.body) {
    const errorText = await response.text().catch(() => "");
    let message = errorText || `DB8 uplink error ${response.status}`;
    try {
      const parsed = JSON.parse(errorText) as { error?: string };
      if (parsed.error?.trim()) message = parsed.error.trim();
    } catch {
      /* keep raw */
    }
    throw new Error(message);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

async function fetchDebateTurn(opts: {
  role: Db8DebateRole;
  topic: string;
  transcript: string;
  voteSummary: string;
  provider: string;
  model: string;
  apiKey: string;
  signal?: AbortSignal;
}): Promise<string> {
  const response = await fetch("/api/db8-debate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: opts.signal,
    body: JSON.stringify({
      role: opts.role,
      topic: opts.topic,
      transcript: opts.transcript,
      voteSummary: opts.voteSummary,
      provider: opts.provider,
      model: opts.model,
      apiKey: opts.apiKey,
    }),
  });
  return (await readPlainTextStream(response)).trim();
}

function voteSummaryFor(entries: Db8DebateEntry[]): string {
  const lines = entries
    .filter((entry) => entry.speaker !== "human" && entry.speaker !== "system")
    .map((entry) => {
      const meta = DB8_SPEAKER_META[entry.speaker];
      return `${meta.label}: +${entry.votes.agree} / -${entry.votes.disagree}`;
    });
  return lines.length > 0 ? lines.join("\n") : "No votes yet.";
}

function DebateEntryCard({
  entry,
  onVote,
}: {
  entry: Db8DebateEntry;
  onVote: (id: string, direction: "agree" | "disagree") => void;
}) {
  const meta = DB8_SPEAKER_META[entry.speaker];
  const canVote = entry.speaker !== "human" && entry.speaker !== "system";

  return (
    <article className="rounded-sm border border-[#1c1c1c] bg-black/75 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-mono text-[9px] tracking-[0.1em]">
          <span className="rounded border border-[#2d2d2d] px-1.5 py-0.5 text-[#8a8a8a]">
            {meta.glyph}
          </span>
          <span className={cn(meta.tone)}>{meta.label}</span>
        </div>
        {canVote ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="rounded border border-emerald-500/30 px-1.5 py-0.5 font-mono text-[9px] text-emerald-300/90 hover:bg-emerald-500/10"
              onClick={() => onVote(entry.id, "agree")}
            >
              +{entry.votes.agree}
            </button>
            <button
              type="button"
              className="rounded border border-rose-500/30 px-1.5 py-0.5 font-mono text-[9px] text-rose-300/90 hover:bg-rose-500/10"
              onClick={() => onVote(entry.id, "disagree")}
            >
              −{entry.votes.disagree}
            </button>
          </div>
        ) : null}
      </div>
      <p className="mt-2 whitespace-pre-wrap font-mono text-[10px] leading-relaxed tracking-[0.03em] text-[#c8c8c8]">
        {entry.text}
      </p>
    </article>
  );
}

export function CyberdeckDb8PaneBody({
  onSpeakLine,
  activeProvider = "opencode",
  modelId = "big-pickle",
  apiKey = "",
}: Db8PaneBodyProps) {
  const [state, setState] = useState<Db8DebateState>(defaultDb8DebateState);
  const [topicDraft, setTopicDraft] = useState("");
  const [composer, setComposer] = useState("");
  const [status, setStatus] = useState("DB8 ready — set a proposition to open the chamber.");
  const [statusKind, setStatusKind] = useState<Db8NoticeKind>("idle");
  const [notices, setNotices] = useState<Db8Notice[]>([]);
  const [activeSpeaker, setActiveSpeaker] = useState<Db8SpeakerId | "conclude" | null>(null);
  const [busy, setBusy] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const voiceQueueRef = useRef(new Db8VoiceQueue());
  const threadRef = useRef<HTMLDivElement | null>(null);

  const pushNotice = useCallback((text: string, kind: Db8NoticeKind = "info") => {
    const entry: Db8Notice = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      kind,
      at: Date.now(),
    };
    setNotices((prev) => [entry, ...prev].slice(0, DB8_NOTICE_LIMIT));
    setStatus(text);
    setStatusKind(kind);
  }, []);

  useEffect(() => {
    const loaded = readDb8DebateState();
    setState(loaded);
    setTopicDraft(loaded.topic);
    setVoiceEnabled(readDb8VoiceEnabled());
  }, []);

  useEffect(() => {
    voiceQueueRef.current.setDeckSpeak(onSpeakLine);
  }, [onSpeakLine]);

  useEffect(() => {
    return () => {
      voiceQueueRef.current.cancel();
    };
  }, []);

  const speakAs = useCallback(async (speaker: Db8SpeakerId | "conclude", text: string) => {
    if (!voiceEnabled || !text.trim()) return;
    const label =
      speaker === "conclude" ? "VAULT // CONSENSUS" : DB8_SPEAKER_META[speaker].label;
    setSpeaking(true);
    setActiveSpeaker(speaker);
    pushNotice(`${label} speaking…`, "voice");
    try {
      await unlockDb8Audio();
      await voiceQueueRef.current.speakOne(speaker, text, voiceEnabled);
      pushNotice(`${label} finished speaking.`, "info");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "voice playback failed";
      pushNotice(`${label} voice failed: ${detail}`, "error");
    } finally {
      setSpeaking(false);
      setActiveSpeaker(null);
    }
  }, [pushNotice, voiceEnabled]);

  useEffect(() => {
    writeDb8DebateState(state);
  }, [state]);

  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [state.entries, state.conclusion, busy]);

  const persist = useCallback((next: Db8DebateState) => {
    setState(next);
  }, []);

  const handleVote = useCallback(
    (id: string, direction: "agree" | "disagree") => {
      const entry = state.entries.find((item) => item.id === id);
      persist({
        ...state,
        entries: state.entries.map((item) =>
          item.id !== id
            ? item
            : {
                ...item,
                votes: {
                  ...item.votes,
                  [direction]: item.votes[direction] + 1,
                },
              },
        ),
      });
      if (entry) {
        const meta = DB8_SPEAKER_META[entry.speaker];
        pushNotice(
          `Vote recorded on ${meta.label}: ${direction === "agree" ? "agree" : "disagree"}.`,
          "info",
        );
      }
    },
    [persist, pushNotice, state],
  );

  const startDebate = useCallback(() => {
    const topic = topicDraft.trim();
    if (!topic) return;
    voiceQueueRef.current.cancel();
    persist({
      topic,
      entries: [
        createDb8Entry(
          "system",
          `Proposition opened: ${topic}. FOR, AGAINST, and MODERATOR will debate until the operator calls consensus.`,
        ),
      ],
      conclusion: "",
      round: 0,
    });
    pushNotice(`Debate opened — proposition: ${topic}`, "success");
    void (async () => {
      await unlockDb8Audio();
      await speakAs("human", operatorPropositionSpeech(topic));
    })();
  }, [persist, pushNotice, speakAs, topicDraft]);

  const postHuman = useCallback(() => {
    const text = composer.trim();
    if (!text || !state.topic.trim()) return;
    persist({
      ...state,
      entries: [...state.entries, createDb8Entry("human", text)],
    });
    setComposer("");
    pushNotice("Operator posted a new argument.", "info");
    void (async () => {
      await unlockDb8Audio();
      await speakAs("human", text);
    })();
  }, [composer, persist, pushNotice, speakAs, state]);

  const runRound = useCallback(async () => {
    if (!state.topic.trim() || busy) return;
    await unlockDb8Audio();
    voiceQueueRef.current.cancel();
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setBusy(true);
    const nextRound = state.round + 1;
    pushNotice(`Round ${nextRound} started — uplink to ${activeProvider} / ${modelId}.`, "progress");

    const speakers: Db8SpeakerId[] = ["for", "against", "moderator"];
    let entries = [...state.entries];

    try {
      for (const speaker of speakers) {
        const role = db8RoleForSpeaker(speaker);
        if (!role) continue;
        setActiveSpeaker(speaker);
        pushNotice(`${DB8_SPEAKER_META[speaker].label} drafting argument…`, "progress");
        const text = await fetchDebateTurn({
          role,
          topic: state.topic,
          transcript: formatDb8Transcript(entries),
          voteSummary: voteSummaryFor(entries),
          provider: activeProvider,
          model: modelId,
          apiKey,
          signal: abortRef.current.signal,
        });
        if (!text) {
          pushNotice(`${DB8_SPEAKER_META[speaker].label} returned an empty response.`, "error");
          continue;
        }
        entries = [...entries, createDb8Entry(speaker, text)];
        persist({ ...state, entries, round: nextRound });
        pushNotice(`${DB8_SPEAKER_META[speaker].label} posted to the thread.`, "success");
        await speakAs(speaker, text);
      }
      pushNotice(`Round ${nextRound} complete.`, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Debate round failed";
      persist({
        ...state,
        entries: [
          ...entries,
          createDb8Entry("system", `Round interrupted: ${message}`),
        ],
      });
      pushNotice(`Round failed: ${message}`, "error");
    } finally {
      setBusy(false);
      setActiveSpeaker(null);
    }
  }, [activeProvider, apiKey, busy, modelId, persist, pushNotice, speakAs, state]);

  const synthesizeConclusion = useCallback(async () => {
    if (!state.topic.trim() || busy) return;
    await unlockDb8Audio();
    voiceQueueRef.current.cancel();
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setBusy(true);
    pushNotice("Synthesizing consensus from debate and votes…", "progress");

    try {
      const text = await fetchDebateTurn({
        role: "conclude",
        topic: state.topic,
        transcript: formatDb8Transcript(state.entries),
        voteSummary: voteSummaryFor(state.entries),
        provider: activeProvider,
        model: modelId,
        apiKey,
        signal: abortRef.current.signal,
      });
      persist({ ...state, conclusion: text });
      pushNotice("Consensus reached — reading conclusion aloud.", "success");
      await speakAs("conclude", `Consensus. ${text}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Consensus failed";
      pushNotice(`Consensus failed: ${message}`, "error");
    } finally {
      setBusy(false);
      setActiveSpeaker(null);
    }
  }, [activeProvider, apiKey, busy, modelId, persist, pushNotice, speakAs, state]);

  const resetDebate = useCallback(() => {
    voiceQueueRef.current.cancel();
    abortRef.current?.abort();
    const fresh = defaultDb8DebateState();
    persist(fresh);
    setTopicDraft("");
    setComposer("");
    setNotices([]);
    setActiveSpeaker(null);
    pushNotice("Debate chamber reset.", "info");
  }, [persist, pushNotice]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-black">
      <CyberdeckPaneHeader
        className="shrink-0"
        left={
          <div className="flex flex-col">
            <CyberdeckPaneHeaderTitle style={{ textShadow: "0 0 6px rgba(57,255,136,0.12)" }}>
              DB8
            </CyberdeckPaneHeaderTitle>
            <CyberdeckPaneHeaderSubtitle>
              DEBATE FORUM // AI + OPERATOR → CONSENSUS
            </CyberdeckPaneHeaderSubtitle>
          </div>
        }
        right={
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 font-mono text-[9px] tracking-[0.08em] text-[#707070]">
              <Switch
                checked={voiceEnabled}
                onCheckedChange={(checked) => {
                  void unlockDb8Audio();
                  setVoiceEnabled(checked);
                  writeDb8VoiceEnabled(checked);
                  if (!checked) voiceQueueRef.current.cancel();
                  pushNotice(checked ? "Voice playback enabled." : "Voice playback muted.", "info");
                }}
                aria-label="DB8 voice playback"
              />
              VOICE
            </label>
            <CyberdeckPaneHeaderValue>
              {speaking ? "SPEAKING" : busy ? "BUSY" : statusKind.toUpperCase()}
            </CyberdeckPaneHeaderValue>
          </div>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-3">
        <Db8StatusPanel
          status={status}
          statusKind={statusKind}
          busy={busy}
          speaking={speaking}
          round={state.round}
          topic={state.topic}
          notices={notices}
          activityOpen={activityOpen}
          onToggleActivity={() => setActivityOpen((open) => !open)}
        />

        {!state.topic.trim() ? (
          <div className="shrink-0 rounded-sm border border-[#1c1c1c] bg-black/80 p-2">
            <label className="font-mono text-[9px] tracking-[0.12em] text-[#707070]">
              PROPOSITION
            </label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              <input
                value={topicDraft}
                onChange={(event) => setTopicDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    startDebate();
                  }
                }}
                placeholder="What should this room decide?"
                disabled={busy}
                className="min-w-[12rem] flex-1 border border-[#2d2d2d] bg-black px-2 py-1.5 font-mono text-[10px] tracking-[0.06em] text-[#d6d6d6] outline-none focus:border-emerald-500/40"
              />
              <CyberdeckActionButton disabled={busy || !topicDraft.trim()} onClick={startDebate}>
                Open
              </CyberdeckActionButton>
            </div>
          </div>
        ) : (
          <div className="shrink-0 space-y-1.5 rounded-sm border border-[#1c1c1c] bg-black/80 p-2">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[8px] tracking-[0.12em] text-[#606060]">PROPOSITION</div>
                <p className="mt-0.5 line-clamp-2 font-mono text-[10px] leading-snug text-[#d0d0d0]">
                  {state.topic}
                </p>
              </div>
              <CyberdeckActionButton variant="neutral" disabled={busy} onClick={resetDebate}>
                Reset
              </CyberdeckActionButton>
            </div>
            <Db8SpeakerChips
              activeSpeaker={activeSpeaker}
              busy={busy}
              speaking={speaking}
              compact
            />
          </div>
        )}

        <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden rounded-sm border border-[#1c1c1c] bg-black/50">
          <div className="shrink-0 border-b border-[#1c1c1c] px-2 py-1 font-mono text-[8px] tracking-[0.14em] text-[#606060]">
            DEBATE THREAD ({state.entries.length})
          </div>
          <div
            ref={threadRef}
            className="custom-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto p-2"
          >
            {state.entries.length === 0 ? (
              <p className="p-4 text-center font-mono text-[10px] tracking-[0.06em] text-[#606060]">
                Set a proposition, then run a debate round. Vote on arguments, then synthesize
                consensus.
              </p>
            ) : (
              state.entries.map((entry) => (
                <DebateEntryCard key={entry.id} entry={entry} onVote={handleVote} />
              ))
            )}
          </div>
        </div>

        {state.conclusion ? (
          <div className="max-h-28 shrink-0 overflow-y-auto rounded-sm border border-emerald-500/25 bg-emerald-500/5 p-2 custom-scrollbar">
            <div className="font-mono text-[9px] tracking-[0.12em] text-emerald-300/80">
              CONSENSUS
            </div>
            <p className="mt-1 whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-[#d0d0d0]">
              {state.conclusion}
            </p>
          </div>
        ) : null}

        <div className="shrink-0 space-y-2 rounded-sm border border-[#1c1c1c] bg-black/80 p-2">
          <textarea
            value={composer}
            onChange={(event) => setComposer(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                postHuman();
              }
            }}
            rows={2}
            disabled={busy || !state.topic.trim()}
            placeholder={
              state.topic.trim()
                ? "Operator argument (Enter to post, Shift+Enter for newline)"
                : "Open a proposition first"
            }
            className="w-full resize-none border border-[#2d2d2d] bg-black px-2 py-1.5 font-mono text-[10px] tracking-[0.04em] text-[#cfcfcf] outline-none focus:border-emerald-500/40 disabled:opacity-50"
          />
          <div className="flex flex-wrap gap-2">
            <CyberdeckActionButton
              className="flex-1"
              disabled={busy || !composer.trim() || !state.topic.trim()}
              onClick={postHuman}
            >
              Post
            </CyberdeckActionButton>
            <CyberdeckActionButton
              className="flex-1"
              variant="accent"
              disabled={busy || !state.topic.trim()}
              onClick={() => void runRound()}
            >
              {busy ? "Debating…" : "Next round"}
            </CyberdeckActionButton>
            <CyberdeckActionButton
              className="flex-1"
              variant="neutral"
              disabled={busy || state.entries.length < 2 || !state.topic.trim()}
              onClick={() => void synthesizeConclusion()}
            >
              Conclude
            </CyberdeckActionButton>
          </div>
        </div>
      </div>
    </div>
  );
}
