"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CyberdeckActionButton } from "@/components/cyberdeck/action-button";
import { fetchPmCaseMatches, persistPmCallRecord } from "@/lib/pm-call-center/case-client";
import { fetchPmCallObserverDigest, fetchPmCallResidentTurn } from "@/lib/pm-call-center/client";
import { pmCallScenarioById, PM_CALL_SCENARIOS } from "@/lib/pm-call-center/scenarios";
import {
  appendPmCallEpisode,
  clearPmCallSimSession,
  readPmCallEpisodes,
  readPmCallSimSession,
  writePmCallSimSession,
} from "@/lib/pm-call-center/storage";
import { createPmCallTurn } from "@/lib/pm-call-center/transcript";
import type {
  PmCallEpisode,
  PmCallEpisodeDigest,
  PmCallObserverProgressEvent,
  PmCallPersistence,
  PmCallScenario,
  PmCallSimPhase,
  PmCallTurn,
} from "@/lib/pm-call-center/types";
import type { CaseMatchCandidate } from "@/lib/property-manager/cases/types";
import { cn } from "@/lib/utils";

type SimPhase = PmCallSimPhase;

/** Snapshot taken when operator opens scenario picker — Cancel restores this. */
type PickerReturnState = {
  phase: Exclude<SimPhase, "pick" | "observing">;
  scenario: PmCallScenario;
  turns: PmCallTurn[];
  composer: string;
  operatorNotesDraft: string;
  digest: PmCallEpisodeDigest | null;
  status: string;
  matchedCase: CaseMatchCandidate | null;
  lastPersistence: PmCallPersistence | null;
};

type ObserverFeedItem = {
  step: string;
  message: string;
  detail?: string;
  state: "active" | "done" | "error";
};

function pushObserverFeedItem(
  prev: ObserverFeedItem[],
  event: { step: string; message: string; detail?: string },
): ObserverFeedItem[] {
  const done = prev.map((item) =>
    item.state === "active" ? { ...item, state: "done" as const } : item,
  );
  const existing = done.findIndex((item) => item.step === event.step);
  if (existing >= 0) {
    return done.map((item, index) =>
      index === existing
        ? { ...item, message: event.message, detail: event.detail, state: "active" as const }
        : item,
    );
  }
  return [...done, { ...event, state: "active" as const }];
}

function finishObserverFeed(prev: ObserverFeedItem[]): ObserverFeedItem[] {
  return prev.map((item) =>
    item.state === "active" ? { ...item, state: "done" as const } : item,
  );
}

function failObserverFeed(prev: ObserverFeedItem[]): ObserverFeedItem[] {
  return prev.map((item) =>
    item.state === "active" ? { ...item, state: "error" as const } : item,
  );
}

function observerStatusLine(message: string, detail?: string): string {
  return detail ? `${message} — ${detail}` : message;
}

function ObserverActivityFeed({ items }: { items: ObserverFeedItem[] }) {
  return (
    <div
      className="space-y-2 rounded-sm border border-emerald-500/25 bg-emerald-500/5 p-3"
      aria-live="polite"
      aria-busy={items.some((item) => item.state === "active")}
    >
      <div className="font-mono text-[9px] tracking-[0.12em] text-emerald-300/90">OBSERVER ACTIVITY</div>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li
            key={item.step}
            className={cn(
              "flex gap-2 font-mono text-[9px] leading-relaxed tracking-[0.04em]",
              item.state === "error" ? "text-rose-300" : "text-[#b0b0b0]",
            )}
          >
            <span className="mt-[1px] shrink-0 w-[1.1rem] text-center" aria-hidden>
              {item.state === "done" ? "✓" : item.state === "error" ? "!" : "…"}
            </span>
            <span>
              <span className={item.state === "active" ? "text-emerald-200" : undefined}>
                {item.message}
              </span>
              {item.detail ? (
                <span className="mt-0.5 block text-[8px] tracking-[0.05em] text-[#707070]">
                  {item.detail}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type CallCenterPanelProps = {
  activeProvider?: string;
  modelId?: string;
  apiKey?: string;
};

function categoryLabel(category: PmCallScenario["category"]): string {
  return category.toUpperCase();
}

function urgencyClass(urgency: string): string {
  switch (urgency) {
    case "emergency":
      return "text-rose-300";
    case "high":
      return "text-amber-300";
    case "low":
      return "text-[#8a8a8a]";
    default:
      return "text-emerald-300";
  }
}

function TurnBubble({
  turn,
  notesEditable,
  onNotesChange,
}: {
  turn: PmCallTurn;
  notesEditable?: boolean;
  onNotesChange?: (turnId: string, notes: string) => void;
}) {
  const isOperator = turn.role === "operator";
  const isSystem = turn.role === "system";
  const showNotes = isOperator && (notesEditable || Boolean(turn.notes?.trim()));

  if (isSystem) {
    return (
      <div className="flex justify-center py-1">
        <div className="rounded-sm border border-rose-500/35 bg-rose-500/10 px-3 py-1.5 font-mono text-[9px] tracking-[0.14em] text-rose-200">
          {turn.text}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex", isOperator ? "justify-end" : "justify-start")}>
      <article
        className={cn(
          "max-w-[92%] rounded-sm border px-2.5 py-2",
          isOperator
            ? "border-emerald-500/35 bg-emerald-500/8"
            : "border-sky-500/35 bg-sky-500/8",
        )}
      >
        <div className="font-mono text-[8px] tracking-[0.12em] text-[#606060]">
          {isOperator ? "OPERATOR" : "RESIDENT"}
        </div>
        <p className="mt-1 whitespace-pre-wrap font-mono text-[10px] leading-relaxed tracking-[0.03em] text-[#d0d0d0]">
          {turn.text}
        </p>
        {showNotes ? (
          <div className="mt-2 border-t border-emerald-500/20 pt-2">
            <div className="font-mono text-[8px] tracking-[0.12em] text-[#707070]">
              THINKING NOTES
            </div>
            {notesEditable && onNotesChange ? (
              <textarea
                value={turn.notes ?? ""}
                rows={2}
                onChange={(event) => onNotesChange(turn.id, event.target.value)}
                placeholder="Why you said this, urgency read, next step in mind…"
                className="custom-scrollbar mt-1 w-full resize-y border border-[#2d2d2d] bg-black/60 px-2 py-1 font-mono text-[9px] leading-relaxed tracking-[0.03em] text-[#a8a8a8] outline-none focus:border-emerald-500/35"
              />
            ) : turn.notes?.trim() ? (
              <p className="mt-1 whitespace-pre-wrap font-mono text-[9px] leading-relaxed tracking-[0.03em] text-[#a8a8a8]">
                {turn.notes}
              </p>
            ) : null}
          </div>
        ) : null}
      </article>
    </div>
  );
}

function DigestCard({ digest }: { digest: PmCallEpisodeDigest }) {
  return (
    <div className="space-y-2 rounded-sm border border-[#25352c] bg-black/80 p-3 font-mono text-[10px] leading-relaxed text-[#b0b0b0]">
      <div className="text-[9px] tracking-[0.1em] text-emerald-300/90">OBSERVER DIGEST</div>
      <p>
        <span className="text-[#707070]">Intent:</span> {digest.residentIntent}
      </p>
      <p>
        <span className="text-[#707070]">Routing:</span> {digest.routing.department}{" "}
        <span className={urgencyClass(digest.routing.urgency)}>({digest.routing.urgency})</span>
      </p>
      {digest.operatorActions.length > 0 ? (
        <ul className="list-inside list-disc text-[#9a9a9a]">
          {digest.operatorActions.map((action) => (
            <li key={action}>{action}</li>
          ))}
        </ul>
      ) : null}
      {digest.goodPhrases.length > 0 ? (
        <div>
          <div className="text-[#707070]">Phrases worth keeping</div>
          <ul className="mt-1 list-inside list-disc text-[#c8c8c8]">
            {digest.goodPhrases.map((phrase) => (
              <li key={phrase}>{phrase}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <p>
        <span className="text-[#707070]">Lesson:</span> {digest.lesson}
      </p>
    </div>
  );
}

/** Text-only call simulation — operator trains against AI resident; observer on close. */
export function CallCenterPanel({
  activeProvider = "opencode",
  modelId = "big-pickle",
  apiKey = "",
}: CallCenterPanelProps) {
  const [hydrated, setHydrated] = useState(false);
  const [phase, setPhase] = useState<SimPhase>("pick");
  const [scenario, setScenario] = useState<PmCallScenario | null>(null);
  const [turns, setTurns] = useState<PmCallTurn[]>([]);
  const [composer, setComposer] = useState("");
  const [operatorNotesDraft, setOperatorNotesDraft] = useState("");
  const [status, setStatus] = useState("Pick a scenario to start a text simulation.");
  const [busy, setBusy] = useState(false);
  const [digest, setDigest] = useState<PmCallEpisodeDigest | null>(null);
  const [episodes, setEpisodes] = useState<PmCallEpisode[]>([]);
  const [showArchive, setShowArchive] = useState(false);
  const [matchedCase, setMatchedCase] = useState<CaseMatchCandidate | null>(null);
  const [lastPersistence, setLastPersistence] = useState<PmCallPersistence | null>(null);
  const [pickerReturn, setPickerReturn] = useState<PickerReturnState | null>(null);
  const [observerFeed, setObserverFeed] = useState<ObserverFeedItem[]>([]);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);

  const focusComposer = useCallback(() => {
    window.requestAnimationFrame(() => {
      composerRef.current?.focus({ preventScroll: true });
    });
  }, []);

  useEffect(() => {
    setEpisodes(readPmCallEpisodes());
    const saved = readPmCallSimSession();
    if (saved) {
      const restoredScenario = pmCallScenarioById(saved.scenarioId);
      if (restoredScenario) {
        setScenario(restoredScenario);
        setTurns(saved.turns);
        setComposer(saved.composer);
        setOperatorNotesDraft(saved.operatorNotesDraft ?? "");
        setDigest(saved.digest);
        setPhase(saved.phase);
        setStatus(
          saved.status.includes("restored")
            ? saved.status
            : `${saved.status} (session restored)`,
        );
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (phase === "pick") {
      if (!pickerReturn) clearPmCallSimSession();
      return;
    }
    if (!scenario) {
      clearPmCallSimSession();
      return;
    }
    if (phase === "observing") return;

    writePmCallSimSession({
      schemaVersion: 1,
      phase,
      scenarioId: scenario.id,
      turns,
      composer,
      operatorNotesDraft,
      digest,
      status,
      updatedAt: Date.now(),
    });
  }, [hydrated, phase, scenario, turns, composer, operatorNotesDraft, digest, status, pickerReturn]);

  useEffect(() => {
    if (!hydrated || phase !== "live") return;
    focusComposer();
  }, [hydrated, phase, focusComposer]);

  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [turns, busy, digest, observerFeed]);

  const startScenario = useCallback(async (next: PmCallScenario) => {
    abortRef.current?.abort();
    setPickerReturn(null);
    setScenario(next);
    setTurns([createPmCallTurn("resident", next.openingLine)]);
    setComposer("");
    setOperatorNotesDraft("");
    setDigest(null);
    setLastPersistence(null);
    setPhase("live");
    setStatus(`Live — ${next.title}. Reply as the operator.`);

    try {
      const { bestMatch } = await fetchPmCaseMatches(next.id);
      setMatchedCase(bestMatch);
      if (bestMatch) {
        setStatus(
          `Live — ${next.title}. Open case ${bestMatch.caseId} matched (${bestMatch.matchReasons.join(", ")}).`,
        );
      }
    } catch {
      setMatchedCase(null);
    }

    focusComposer();
  }, [focusComposer]);

  const updateTurnNotes = useCallback((turnId: string, notes: string) => {
    const trimmed = notes.trim();
    setTurns((prev) =>
      prev.map((turn) =>
        turn.id !== turnId
          ? turn
          : { ...turn, notes: trimmed || undefined },
      ),
    );
  }, []);

  const hangUpCall = useCallback(() => {
    if (!scenario || phase !== "live" || busyRef.current) return;
    const hasOperatorTurn = turns.some((turn) => turn.role === "operator");
    if (!hasOperatorTurn) {
      setStatus("Say something as the operator before hanging up.");
      return;
    }

    abortRef.current?.abort();
    busyRef.current = false;
    setBusy(false);
    setComposer("");
    setOperatorNotesDraft("");
    setTurns((prev) => [
      ...prev,
      createPmCallTurn("system", "— OPERATOR HUNG UP — CALL ENDED —"),
    ]);
    setPhase("hung_up");
    setStatus("Call ended. Review notes, then run the observer.");
  }, [phase, scenario, turns]);

  const notifyObserverProgress = useCallback((event: PmCallObserverProgressEvent) => {
    setObserverFeed((prev) => pushObserverFeedItem(prev, event));
    setStatus(observerStatusLine(event.message, event.detail));
  }, []);

  const notifyObserverStep = useCallback((step: string, message: string, detail?: string) => {
    setObserverFeed((prev) => pushObserverFeedItem(prev, { step, message, detail }));
    setStatus(observerStatusLine(message, detail));
  }, []);

  const runObserver = useCallback(async () => {
    if (!scenario || phase !== "hung_up") {
      return;
    }
    if (!turns.some((turn) => turn.role === "operator")) {
      setStatus("Add at least one operator reply before running the observer.");
      return;
    }
    if (!apiKey.trim()) {
      setStatus("Gateway API key required for observer digest.");
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    busyRef.current = true;
    setBusy(true);
    setPhase("observing");
    setObserverFeed([]);
    notifyObserverStep("start", "Observer run started", scenario.title);

    try {
      const nextDigest = await fetchPmCallObserverDigest({
        scenarioId: scenario.id,
        turns,
        provider: activeProvider,
        model: modelId,
        apiKey,
        signal: abortRef.current.signal,
        onProgress: notifyObserverProgress,
      });
      setDigest(nextDigest);
      const endedAt = Date.now();

      notifyObserverStep(
        "persist",
        "Saving call to case file",
        matchedCase ? `Attaching to ${matchedCase.caseId}` : "Matching open case or creating new",
      );
      const persistence = await persistPmCallRecord({
        scenarioId: scenario.id,
        turns,
        digest: nextDigest,
        startedAt: turns[0]?.at ?? endedAt,
        endedAt,
        attachCaseSlug: matchedCase?.slug,
      });
      setLastPersistence(persistence);

      notifyObserverStep(
        "archive",
        "Archiving training simulation",
        `${persistence.callId} → ${persistence.caseId}`,
      );

      const episode: PmCallEpisode = {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}`,
        startedAt: turns[0]?.at ?? endedAt,
        endedAt,
        scenarioId: scenario.id,
        turns,
        digest: nextDigest,
        persistence,
      };
      setEpisodes(appendPmCallEpisode(episode));
      setObserverFeed((prev) => finishObserverFeed(prev));
      setPhase("review");
      setStatus(
        persistence.createdCase
          ? `Case ${persistence.caseId} created — call ${persistence.callId} saved to disk.`
          : `Call ${persistence.callId} attached to case ${persistence.caseId}.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Observer failed";
      setObserverFeed((prev) => failObserverFeed(prev));
      setPhase("hung_up");
      setStatus(`Observer failed: ${message}`);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [
    activeProvider,
    apiKey,
    matchedCase?.caseId,
    matchedCase?.slug,
    modelId,
    notifyObserverProgress,
    notifyObserverStep,
    phase,
    scenario,
    turns,
  ]);

  const sendOperatorLine = useCallback(async () => {
    const text = composer.trim();
    if (!text || !scenario || busyRef.current || phase !== "live") return;
    if (!apiKey.trim()) {
      setStatus("Set a gateway API key to run AI resident replies.");
      return;
    }

    const withOperator = [
      ...turns,
      createPmCallTurn("operator", text, operatorNotesDraft),
    ];
    setTurns(withOperator);
    setComposer("");
    setOperatorNotesDraft("");
    busyRef.current = true;
    setBusy(true);
    setStatus("Resident is responding…");

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const residentLine = await fetchPmCallResidentTurn({
        scenarioId: scenario.id,
        turns: withOperator,
        provider: activeProvider,
        model: modelId,
        apiKey,
        signal: abortRef.current.signal,
      });
      if (!residentLine) {
        setStatus("Resident returned empty — try another operator line.");
        focusComposer();
        return;
      }
      setTurns((prev) => [...prev, createPmCallTurn("resident", residentLine)]);
      setStatus("Your turn — reply as operator.");
      focusComposer();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Resident uplink failed";
      setStatus(message);
      focusComposer();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [activeProvider, apiKey, composer, focusComposer, modelId, operatorNotesDraft, phase, scenario, turns]);

  const resetToPicker = useCallback(() => {
    abortRef.current?.abort();
    clearPmCallSimSession();
    setPickerReturn(null);
    setPhase("pick");
    setScenario(null);
    setTurns([]);
    setComposer("");
    setOperatorNotesDraft("");
    setDigest(null);
    setMatchedCase(null);
    setLastPersistence(null);
    setStatus("Pick a scenario to start a text simulation.");
  }, []);

  const openScenarioPicker = useCallback(() => {
    if (phase === "pick" || !scenario || phase === "observing") return;
    if (phase !== "live" && phase !== "hung_up" && phase !== "review") return;

    abortRef.current?.abort();
    busyRef.current = false;
    setBusy(false);
    setPickerReturn({
      phase,
      scenario,
      turns,
      composer,
      operatorNotesDraft,
      digest,
      status,
      matchedCase,
      lastPersistence,
    });
    setPhase("pick");
    setStatus("Pick a scenario, or cancel to return to your previous session.");
  }, [
    composer,
    digest,
    lastPersistence,
    matchedCase,
    operatorNotesDraft,
    phase,
    scenario,
    status,
    turns,
  ]);

  const cancelScenarioPicker = useCallback(() => {
    if (!pickerReturn) return;

    const snapshot = pickerReturn;
    setPickerReturn(null);
    setScenario(snapshot.scenario);
    setTurns(snapshot.turns);
    setComposer(snapshot.composer);
    setOperatorNotesDraft(snapshot.operatorNotesDraft);
    setDigest(snapshot.digest);
    setMatchedCase(snapshot.matchedCase);
    setLastPersistence(snapshot.lastPersistence);
    setPhase(snapshot.phase);
    setStatus(snapshot.status);
  }, [pickerReturn]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-sm border border-[#1c1c1c] bg-black/75 px-2 py-1.5">
        <div className="font-mono text-[9px] tracking-[0.08em] text-[#8a8a8a]">
          TEXT SIM // {phase.toUpperCase()}
          {scenario ? ` // ${scenario.title}` : ""}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {phase !== "pick" ? (
            <CyberdeckActionButton variant="neutral" disabled={busy} onClick={openScenarioPicker}>
              New
            </CyberdeckActionButton>
          ) : null}
          {phase === "pick" && pickerReturn ? (
            <CyberdeckActionButton variant="neutral" onClick={cancelScenarioPicker}>
              Cancel
            </CyberdeckActionButton>
          ) : null}
          {phase === "hung_up" ? (
            <CyberdeckActionButton disabled={busy} onClick={() => void runObserver()}>
              Run observer
            </CyberdeckActionButton>
          ) : null}
          <CyberdeckActionButton
            variant="neutral"
            onClick={() => setShowArchive((open) => !open)}
          >
            {showArchive ? "Hide log" : `Log (${episodes.length})`}
          </CyberdeckActionButton>
        </div>
      </div>

      <p className="shrink-0 font-mono text-[9px] tracking-[0.06em] text-[#707070]">{status}</p>

      {phase === "pick" ? (
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
          {pickerReturn ? (
            <p className="mb-2 font-mono text-[9px] tracking-[0.06em] text-[#8a9a90]">
              Browsing scenarios — <span className="text-emerald-300/90">Cancel</span> returns to{" "}
              {pickerReturn.scenario.title} ({pickerReturn.phase.replace("_", " ")}).
            </p>
          ) : null}
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {PM_CALL_SCENARIOS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void startScenario(item)}
                className="rounded-sm border border-[#25352c] bg-black/70 p-3 text-left transition-colors hover:border-emerald-500/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-mono text-[11px] tracking-[0.05em] text-[#d6d6d6]">
                    {item.title}
                  </div>
                  <span className="shrink-0 font-mono text-[8px] tracking-[0.1em] text-emerald-300/80">
                    {categoryLabel(item.category)}
                  </span>
                </div>
                <p className="mt-2 font-mono text-[10px] leading-relaxed text-[#707070]">
                  {item.description}
                </p>
                <p className="mt-2 line-clamp-2 font-mono text-[9px] italic text-[#8a9a90]">
                  &ldquo;{item.openingLine}&rdquo;
                </p>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 basis-0 flex-col gap-2 overflow-hidden">
          <div
            ref={threadRef}
            className="custom-scrollbar min-h-0 flex-1 basis-0 space-y-2 overflow-y-auto rounded-sm border border-[#1c1c1c] bg-black/50 p-2"
          >
            {turns.map((turn) => (
              <TurnBubble
                key={turn.id}
                turn={turn}
                notesEditable={
                  turn.role === "operator" &&
                  (phase === "live" || phase === "hung_up" || phase === "review")
                }
                onNotesChange={updateTurnNotes}
              />
            ))}
            {phase === "observing" && observerFeed.length > 0 ? (
              <ObserverActivityFeed items={observerFeed} />
            ) : null}
            {busy && phase !== "observing" ? (
              <div className="font-mono text-[9px] tracking-[0.1em] text-[#606060]">…</div>
            ) : null}
            {phase === "review" && digest ? <DigestCard digest={digest} /> : null}
            {phase === "review" && lastPersistence ? (
              <div className="rounded-sm border border-[#25352c] bg-black/80 p-3 font-mono text-[10px] leading-relaxed text-[#b0b0b0]">
                <div className="text-[9px] tracking-[0.1em] text-emerald-300/90">CASE PERSISTENCE</div>
                <p className="mt-1">
                  <span className="text-[#707070]">Case:</span> {lastPersistence.caseId}
                </p>
                <p>
                  <span className="text-[#707070]">Call:</span> {lastPersistence.callId}
                </p>
                <p>
                  <span className="text-[#707070]">Folder:</span> {lastPersistence.folderRelative}
                </p>
                <p className="text-[#8a8a8a]">
                  {lastPersistence.createdCase ? "New case opened." : "Attached to existing open case."}
                </p>
              </div>
            ) : null}
          </div>

          {phase === "live" ? (
            <div className="shrink-0 space-y-1.5 rounded-sm border border-[#1c1c1c] bg-black/80 p-2">
              <label className="font-mono text-[8px] tracking-[0.12em] text-[#606060]">
                OPERATOR REPLY
              </label>
              <div className="flex flex-wrap items-end gap-2">
                <textarea
                  ref={composerRef}
                  value={composer}
                  rows={2}
                  onChange={(event) => setComposer(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      event.stopPropagation();
                      void sendOperatorLine();
                    }
                  }}
                  disabled={busy}
                  placeholder="Type what you would say on the call… (Enter to send, Shift+Enter for newline)"
                  className="custom-scrollbar min-h-[2.75rem] min-w-[12rem] flex-1 resize-y border border-[#2d2d2d] bg-black px-2 py-1.5 font-mono text-[10px] leading-relaxed tracking-[0.04em] text-[#d6d6d6] outline-none focus:border-emerald-500/40"
                />
                <CyberdeckActionButton disabled={busy || !composer.trim()} onClick={() => void sendOperatorLine()}>
                  Send
                </CyberdeckActionButton>
                <CyberdeckActionButton
                  variant="danger"
                  disabled={busy}
                  onClick={hangUpCall}
                >
                  Hang up
                </CyberdeckActionButton>
              </div>
              <label className="font-mono text-[8px] tracking-[0.12em] text-[#606060]">
                THINKING NOTES (PRIVATE — NOT SPOKEN TO RESIDENT)
              </label>
              <textarea
                value={operatorNotesDraft}
                rows={2}
                onChange={(event) => setOperatorNotesDraft(event.target.value)}
                disabled={busy}
                placeholder="Record your reasoning before you send — urgency, routing, what to ask next…"
                className="custom-scrollbar min-h-[2.5rem] w-full resize-y border border-[#2d2d2d] bg-black px-2 py-1.5 font-mono text-[9px] leading-relaxed tracking-[0.04em] text-[#a8a8a8] outline-none focus:border-emerald-500/35"
              />
              <p className="font-mono text-[8px] tracking-[0.06em] text-[#555]">
                Notes attach to each operator line and feed the observer. Voice and telephony come later.
              </p>
            </div>
          ) : null}

          {phase === "hung_up" ? (
            <div className="shrink-0 space-y-2 rounded-sm border border-rose-500/25 bg-rose-500/5 p-2">
              <p className="font-mono text-[9px] tracking-[0.08em] text-rose-200/90">
                Call is off the line. Edit thinking notes in the thread, then run the observer when ready.
              </p>
              <CyberdeckActionButton className="w-full" disabled={busy} onClick={() => void runObserver()}>
                Run observer
              </CyberdeckActionButton>
            </div>
          ) : null}

          {phase === "review" ? (
            <div className="shrink-0">
              <CyberdeckActionButton className="w-full" onClick={resetToPicker}>
                Run another scenario
              </CyberdeckActionButton>
            </div>
          ) : null}
        </div>
      )}

      {showArchive && episodes.length > 0 ? (
        <div className="custom-scrollbar max-h-40 shrink-0 overflow-y-auto rounded-sm border border-[#1c1c1c] bg-black/70 p-2">
          <div className="mb-1 font-mono text-[8px] tracking-[0.12em] text-[#606060]">
            SAVED SIMULATIONS
          </div>
          <ul className="space-y-1">
            {episodes.map((episode) => (
              <li
                key={episode.id}
                className="font-mono text-[9px] tracking-[0.04em] text-[#8a8a8a]"
              >
                {episode.persistence?.caseId ?? episode.digest?.scenarioTitle ?? episode.scenarioId} —{" "}
                {episode.persistence?.callId ?? episode.digest?.routing.urgency ?? "?"} —{" "}
                {episode.turns.length} turns
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export default CallCenterPanel;
