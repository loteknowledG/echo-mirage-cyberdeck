"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  advancePropertyConversation,
  type PropertyConversationTurn,
  type PropertyIssueClass,
  type PropertyTicketDraft,
} from "@/lib/property-manager/demo-workflow";
import { speakDryFallback } from "@/voice/speakMuthur";

type ListeningState = "idle" | "listening" | "processing" | "speaking" | "unsupported";

type RecognitionResultEvent = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0?: { transcript?: string } }>;
};

type BrowserRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort?: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onresult: ((event: RecognitionResultEvent) => void) | null;
};

const START_MESSAGE: PropertyConversationTurn = {
  role: "muthur",
  text: "After-hours property support online. Tell me what is happening, and I will prepare a draft for staff review.",
};

const SCENARIOS = [
  {
    label: "WATER EMERGENCY",
    prompt: "My name is Rosa Kim in unit 4B. Water is pouring through the ceiling. My number is 555-010-4421.",
  },
  {
    label: "MAINTENANCE",
    prompt: "This is Jordan in apartment 210. My kitchen sink is leaking. Call me at 555-010-8812.",
  },
  {
    label: "LEASING",
    prompt: "I want to schedule a tour for an available apartment. My name is Alex and my number is 555-010-0931.",
  },
  {
    label: "CALLBACK",
    prompt: "Please call me back about the property. This is Sam in unit 8C at 555-010-6620.",
  },
] as const;

function classificationClass(classification: PropertyIssueClass) {
  if (classification === "EMERGENCY") return "border-red-500/60 text-red-300";
  if (classification === "UNKNOWN") return "border-[#303030] text-[#8a8a8a]";
  return "border-emerald-500/60 text-emerald-300";
}

export function PropertyManagerDemo() {
  const [hydrated, setHydrated] = useState(false);
  const [turns, setTurns] = useState<PropertyConversationTurn[]>([START_MESSAGE]);
  const [draft, setDraft] = useState("");
  const [interim, setInterim] = useState("");
  const [classification, setClassification] = useState<PropertyIssueClass>("UNKNOWN");
  const [ticket, setTicket] = useState<PropertyTicketDraft | null>(null);
  const [escalation, setEscalation] = useState("FOLLOW-UP REQUIRED");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [state, setState] = useState<ListeningState>("idle");
  const [micMessage, setMicMessage] = useState("READY FOR BROWSER CALL");
  const [dispatchStatus, setDispatchStatus] = useState("NO DISPATCH REQUESTED");
  const recognitionRef = useRef<BrowserRecognition | null>(null);
  const speechRunRef = useRef(0);
  const turnsRef = useRef<PropertyConversationTurn[]>([START_MESSAGE]);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const stopSpeech = useCallback(() => {
    speechRunRef.current += 1;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setState((current) => (current === "speaking" ? "idle" : current));
  }, []);

  const speakReply = useCallback(
    async (reply: string) => {
      if (!voiceEnabled) {
        setState("idle");
        return;
      }
      stopSpeech();
      const speechId = ++speechRunRef.current;
      setState("speaking");
      try {
        await speakDryFallback(reply);
      } catch {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          await new Promise<void>((resolve) => {
            const utterance = new SpeechSynthesisUtterance(reply);
            utterance.rate = 0.9;
            utterance.onend = () => resolve();
            utterance.onerror = () => resolve();
            window.speechSynthesis.speak(utterance);
          });
        }
      } finally {
        if (speechId === speechRunRef.current) setState("idle");
      }
    },
    [stopSpeech, voiceEnabled],
  );

  const submitCallerTurn = useCallback(
    (value: string) => {
      const text = value.trim();
      if (!text) return;
      stopSpeech();
      setState("processing");
      setInterim("");
      setDispatchStatus("NO DISPATCH REQUESTED");
      const nextTurns = [...turnsRef.current, { role: "caller" as const, text }];
      const result = advancePropertyConversation(nextTurns);
      const completedTurns = [...nextTurns, { role: "muthur" as const, text: result.reply }];
      turnsRef.current = completedTurns;
      setTurns(completedTurns);
      setClassification(result.classification);
      setTicket(result.ticket);
      setEscalation(result.escalation);
      setMicMessage("TRANSCRIPT CAPTURED // TICKET UPDATED");
      void speakReply(result.reply);
      setDraft("");
    },
    [speakReply, stopSpeech],
  );

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [turns, interim]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const speechWindow = window as unknown as {
      SpeechRecognition?: new () => BrowserRecognition;
      webkitSpeechRecognition?: new () => BrowserRecognition;
    };
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setMicMessage("MIC UNAVAILABLE // TYPE TO SIMULATE CALL");
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onstart = () => {
      stopSpeech();
      setState("listening");
      setMicMessage("LIVE MIC // LISTENING");
    };
    recognition.onend = () => setState((current) => (current === "listening" ? "idle" : current));
    recognition.onerror = (event) => {
      setState("idle");
      setMicMessage(`MIC INTERRUPTED // ${(event.error || "UNAVAILABLE").toUpperCase()}`);
    };
    recognition.onresult = (event) => {
      let live = "";
      let final = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result?.[0]?.transcript ?? "";
        if (result?.isFinal) final += text;
        else live += text;
      }
      setInterim(live.trim());
      if (final.trim()) {
        recognition.stop();
        submitCallerTurn(final);
      }
    };
    recognitionRef.current = recognition;
    return () => {
      recognition.abort?.();
      recognitionRef.current = null;
      stopSpeech();
    };
  }, [stopSpeech, submitCallerTurn]);

  const toggleMic = () => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      setState("unsupported");
      setMicMessage("MIC UNAVAILABLE // TYPE TO SIMULATE CALL");
      return;
    }
    if (state === "listening") {
      recognition.stop();
      setState("idle");
      setMicMessage("MIC STOPPED // READY");
      return;
    }
    stopSpeech();
    try {
      recognition.start();
    } catch {
      setState("idle");
      setMicMessage("MIC START FAILED // TRY AGAIN");
    }
  };

  const resetCall = () => {
    recognitionRef.current?.stop();
    stopSpeech();
    turnsRef.current = [START_MESSAGE];
    setTurns([START_MESSAGE]);
    setDraft("");
    setInterim("");
    setClassification("UNKNOWN");
    setTicket(null);
    setEscalation("FOLLOW-UP REQUIRED");
    setDispatchStatus("NO DISPATCH REQUESTED");
    setMicMessage("READY FOR BROWSER CALL");
    setState("idle");
  };

  const submitTyped = (event: FormEvent) => {
    event.preventDefault();
    submitCallerTurn(draft);
  };

  const simulateAuthRequired = () => {
    const line = "AUTH_REQUIRED // NO RETRY LOOP // SUPERVISOR REVIEW NEEDED";
    const nextTurns = [...turnsRef.current, { role: "muthur" as const, text: line }];
    turnsRef.current = nextTurns;
    setTurns(nextTurns);
    setMicMessage(line);
  };

  return (
    <main
      data-testid="property-manager-demo"
      data-hydrated={hydrated ? "true" : "false"}
      className="min-h-[100dvh] w-full max-w-full overflow-x-hidden bg-black px-3 py-3 text-green-300 sm:px-5 sm:py-5"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3">
        <header className="rounded-sm border border-[#18231d] bg-[#030706] p-3">
          <nav data-testid="property-nav" className="mb-3 flex flex-wrap gap-2 font-mono text-[10px] tracking-[0.08em]">
            <Link className="border border-emerald-900 px-2 py-1 text-emerald-300" href="/property-manager">PROPERTY MODE</Link>
            <Link className="border border-[#252525] px-2 py-1 text-[#8a8a8a]" href="/cyberdeck">CYBERDECK</Link>
            <Link className="border border-[#252525] px-2 py-1 text-[#8a8a8a]" href="/send">SEND</Link>
          </nav>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="font-mono text-base tracking-[0.12em] text-emerald-200 sm:text-lg">MUTHUR // PROPERTY MANAGER</h1>
              <p className="mt-1 font-mono text-[10px] tracking-[0.08em] text-[#7a8b82]">
                AFTER-HOURS SUPPORT // BROWSER CALL SIMULATION // NO TELECOM DISPATCH
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 font-mono text-[10px]">
              <span data-testid="voice-state" className="border border-emerald-900 px-2 py-1 text-emerald-300">{state.toUpperCase()}</span>
              <span data-testid="classification" className={`border px-2 py-1 ${classificationClass(classification)}`}>{classification}</span>
            </div>
          </div>
        </header>

        <section className="flex flex-wrap gap-2 rounded-sm border border-[#18231d] bg-[#030706] p-3">
          <span className="w-full font-mono text-[9px] tracking-[0.1em] text-[#788980]">QUICK CALL SCENARIOS</span>
          {SCENARIOS.map((scenario) => (
            <button key={scenario.label} type="button" onClick={() => submitCallerTurn(scenario.prompt)} className="rounded-sm border border-[#243128] bg-black px-3 py-2 font-mono text-[10px] tracking-[0.06em] text-[#b4c7bc] hover:border-emerald-700 hover:text-emerald-200">
              {scenario.label}
            </button>
          ))}
        </section>

        <div data-testid="property-workspace" className="grid min-h-0 grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.9fr)]">
          <section className="flex min-h-[22rem] flex-col rounded-sm border border-[#18231d] bg-[#030706]" aria-label="Live call transcript">
            <div className="flex items-center justify-between border-b border-[#18231d] px-3 py-2 font-mono text-[10px] tracking-[0.1em] text-[#788980]">
              <span>LIVE TRANSCRIPT</span>
              <span className={state === "listening" ? "text-emerald-300" : "text-[#58625e]"}>
                {state === "listening" ? "REC // ACTIVE" : "CHANNEL // STANDBY"}
              </span>
            </div>
            <div data-testid="transcript" aria-live="polite" className="flex min-h-[14rem] flex-1 flex-col gap-3 overflow-y-auto p-3 font-mono text-[12px] leading-relaxed">
              {turns.map((turn, index) => (
                <div key={`${turn.role}-${index}`} className={turn.role === "muthur" ? "text-emerald-300" : "text-[#d0d6d2]"}>
                  <span className="mr-2 text-[10px] text-[#67746e]">{turn.role === "muthur" ? "MUTHUR" : "CALLER"} //</span>
                  {turn.text}
                </div>
              ))}
              {interim ? (
                <div data-testid="interim-transcript" className="text-[#a5b7ae]">
                  <span className="mr-2 text-[10px] text-amber-300">CALLER // LIVE</span>{interim}
                </div>
              ) : null}
              <div ref={transcriptEndRef} />
            </div>
            <form onSubmit={submitTyped} className="border-t border-[#18231d] p-3">
              <label className="sr-only" htmlFor="property-manager-message">Simulated caller message</label>
              <textarea id="property-manager-message" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Speak, or type a simulated tenant call..." rows={3} className="block w-full resize-none rounded-sm border border-[#25352c] bg-black px-3 py-2 font-mono text-sm text-[#d2ddd7] outline-none placeholder:text-[#54605a] focus:border-emerald-600" />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button data-testid="talk-button" type="button" onClick={toggleMic} className="rounded-sm border border-emerald-700 bg-emerald-950/25 px-3 py-2 font-mono text-[11px] tracking-[0.1em] text-emerald-200">
                  {state === "listening" ? "STOP LISTENING" : "PRESS TO TALK"}
                </button>
                <button type="submit" disabled={!draft.trim()} className="rounded-sm border border-[#2d4035] px-3 py-2 font-mono text-[11px] tracking-[0.1em] text-[#ccd8d1] disabled:opacity-35">SEND TEXT</button>
                <button type="button" onClick={() => { setVoiceEnabled((enabled) => !enabled); stopSpeech(); }} aria-pressed={voiceEnabled} className="rounded-sm border border-[#2d4035] px-3 py-2 font-mono text-[10px] text-[#9fb2a8]">
                  SPEAKER {voiceEnabled ? "ON" : "OFF"}
                </button>
                {state === "speaking" ? <button type="button" onClick={stopSpeech} className="rounded-sm border border-amber-700 px-3 py-2 font-mono text-[10px] text-amber-300">INTERRUPT</button> : null}
              </div>
              <p data-testid="mic-message" className="mt-3 font-mono text-[10px] tracking-[0.08em] text-[#718078]">{micMessage}</p>
            </form>
          </section>

          <aside className="flex min-w-0 flex-col gap-3" aria-label="Ticket draft">
            <section className="rounded-sm border border-[#18231d] bg-[#030706] p-3">
              <div className="mb-3 flex items-center justify-between gap-2 font-mono text-[10px] tracking-[0.1em] text-[#788980]">
                <span>TICKET DRAFT</span><span data-testid="escalation">{escalation}</span>
              </div>
              <pre data-testid="ticket-draft" className="min-h-[14rem] overflow-x-auto whitespace-pre-wrap break-words rounded-sm border border-[#18231d] bg-black p-3 font-mono text-[11px] leading-relaxed text-emerald-200">
                {ticket ? JSON.stringify(ticket, null, 2) : "// Waiting for issue classification."}
              </pre>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => ticket && setDispatchStatus(ticket.priority === "emergency" ? "MOCK ESCALATION QUEUED // ON-CALL MANAGER + MAINTENANCE" : "MOCK WORK ORDER QUEUED // STAFF REVIEW REQUIRED")} disabled={!ticket} className="rounded-sm border border-amber-800 px-3 py-2 font-mono text-[10px] tracking-[0.08em] text-amber-300 disabled:opacity-35">
                  MOCK VENDOR DISPATCH
                </button>
                <button type="button" onClick={resetCall} className="rounded-sm border border-[#2d4035] px-3 py-2 font-mono text-[10px] tracking-[0.08em] text-[#9fb2a8]">RESET CALL</button>
              </div>
              <p data-testid="dispatch-status" className="mt-3 font-mono text-[10px] tracking-[0.08em] text-amber-300">{dispatchStatus}</p>
            </section>
            <section className="rounded-sm border border-[#18231d] bg-[#030706] p-3 font-mono text-[10px] text-[#889890]">
              <div className="mb-2 tracking-[0.1em] text-[#788980]">SAFETY / AUTH SPOT CHECK</div>
              <p>Emergency calls are drafted for human escalation. No real vendor contact occurs in demo mode.</p>
              <button type="button" onClick={simulateAuthRequired} className="mt-3 rounded-sm border border-[#2d4035] px-3 py-2 text-[10px] tracking-[0.08em] text-[#a4b5ad]">
                SIMULATE AUTH_REQUIRED
              </button>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
