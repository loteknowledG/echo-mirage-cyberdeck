"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { CyberdeckVoiceTuning } from "@/lib/cyberdeck-voice-tuning";
import type { Db8DeckSpeakLine } from "@/lib/db8-voice";
import { selectMuthurFallbackVoice } from "@/voice/speakMuthur";
import { MUTHUR_PRESET } from "@/voice/muthurPreset";
import {
  buildMuthurVoiceMasterCopy,
  buildMuthurVoiceTuning,
  getInitialMuthurVoiceDials,
  muthurBrowserSpeechTuning,
  muthurMasterGain,
  restoreMuthurVoiceMasterCopy,
  saveMuthurVoiceMasterCopy,
  type MuthurVoiceDialState,
} from "@/voice/muthurVoiceSettings";
import { splitIntoSpeechBlocks } from "@/lib/muthur-voice-blocks";
import { loadComputerUse } from "@/features/cyberdeck/runtime/defer-computer-use";
import {
  loadDeckAudio,
  playDeckBleepBloop,
  setDeckUplinkSonarVolume,
  setDeckSfxVolume,
} from "@/features/cyberdeck/runtime/defer-deck-audio";
import {
  getInitialUplinkSonarVolume,
  saveUplinkSonarVolume,
} from "@/lib/cyberdeck/uplink-sonar-volume";
import {
  getInitialDeckSfxVolume,
  saveDeckSfxVolume,
} from "@/lib/cyberdeck/deck-sfx-volume";
import { playBeep } from "@/lib/deck-audio";
import { emitSignal } from "@/lib/cyberdeck/signal-router";
import {
  isAudioAllowed,
  registerAudioStopHook,
  subscribeAudioGate,
} from "@/lib/cyberdeck/audio-gate";
import type { MuthurChatMessage } from "@/lib/muthur-core/muthur-command-console";
import { textForSpeech } from "@/features/cyberdeck/muthur/coding-verify-format";
import { MotherTerminal } from "@/features/cyberdeck/voice/mother-terminal";

export type CyberdeckVoiceHealth = "idle" | "backend" | "fallback" | "off";

export type UseCyberdeckVoiceOptions = {
  messages: MuthurChatMessage[];
  isStreaming: boolean;
  openaiApiKey: string;
  setMessages: (updater: (prev: MuthurChatMessage[]) => MuthurChatMessage[]) => void;
};

export function useCyberdeckVoice({
  messages,
  isStreaming,
  openaiApiKey,
  setMessages,
}: UseCyberdeckVoiceOptions) {
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voicePlaybackBusy, setVoicePlaybackBusy] = useState(false);
  const [voiceBlockFocusIndex, setVoiceBlockFocusIndex] = useState(0);
  const [voiceBlockTotal, setVoiceBlockTotal] = useState(0);
  const [voiceDial, setVoiceDial] = useState<MuthurVoiceDialState>(getInitialMuthurVoiceDials);
  const [sonarVolume, setSonarVolume] = useState(getInitialUplinkSonarVolume);
  const [deckSfxVolume, setDeckSfxVolumeState] = useState(getInitialDeckSfxVolume);
  const [voiceHealth, setVoiceHealth] = useState<CyberdeckVoiceHealth>("idle");

  const lastSpokenAssistantTextRef = useRef<string>("");
  const assistantVoiceBlocksRef = useRef<string[]>([]);
  const speakQueueActiveRef = useRef(false);
  const speakSequenceRef = useRef(0);
  const lastVoiceErrorRef = useRef<string>("");
  const voiceDialRef = useRef<MuthurVoiceDialState>(getInitialMuthurVoiceDials());
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeSourceNodesRef = useRef<AudioBufferSourceNode[]>([]);
  const motherMasterGainRef = useRef<GainNode | null>(null);
  const motherTerminalRef = useRef(new MotherTerminal({ burstThreshold: 180 }));
  const networkFeedbackDelayRef = useRef<number | null>(null);
  const networkFeedbackRepeatRef = useRef<number | null>(null);

  const handleDeckSfxVolumeChange = useCallback((volume: number) => {
    setDeckSfxVolumeState((prev) => {
      if (prev <= 0 && volume > 0) {
        playBeep();
      }
      return volume;
    });
    saveDeckSfxVolume(volume);
    emitSignal({
      source: "audio",
      type: "setting_changed",
      payload: { key: "deck_sfx_volume", value: volume },
      severity: "info",
    });
  }, []);

  const stopMirageAudio = useCallback(() => {
    activeSourceNodesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch {
        /* ignore */
      }
    });
    activeSourceNodesRef.current = [];
    speakQueueActiveRef.current = false;
  }, []);

  const playMirageBuffer = useCallback(async (arrayBuffer: ArrayBuffer) => {
    if (!isAudioAllowed()) return false;
    if (typeof window === "undefined") return false;
    const Ctx =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return false;

    const ctx = audioContextRef.current ?? new Ctx();
    audioContextRef.current = ctx;
    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const source = ctx.createBufferSource();
    source.buffer = decoded;
    const deckAudio = await loadDeckAudio();
    const output = deckAudio.applyMuthurEffectChain(ctx, source, {
      ...MUTHUR_PRESET.playback,
    });

    const masterOutput = motherMasterGainRef.current ?? ctx.destination;
    output.connect(masterOutput);

    activeSourceNodesRef.current.push(source);
    source.start(0);

    await new Promise<void>((resolve) => {
      source.onended = () => {
        activeSourceNodesRef.current = activeSourceNodesRef.current.filter((s) => s !== source);
        resolve();
      };
    });
    return true;
  }, []);

  const initMotherAudio = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    const Ctx =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;

    const ctx = audioContextRef.current ?? new Ctx();
    audioContextRef.current = ctx;
    if (!motherMasterGainRef.current) {
      const master = ctx.createGain();
      master.gain.value = muthurMasterGain(voiceDialRef.current.volume);
      master.connect(ctx.destination);
      motherMasterGainRef.current = master;
    }
    return ctx;
  }, []);

  const unlockMotherAudio = useCallback(async () => {
    const ctx = initMotherAudio();
    if (!ctx) return null;
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    return ctx;
  }, [initMotherAudio]);

  const motherTone = useCallback(
    (freq: number, time: number, duration: number, gain = 0.04, type: OscillatorType = "sine") => {
      const ctx = audioContextRef.current;
      const master = motherMasterGainRef.current;
      if (!ctx || !master) return;

      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, time);

      g.gain.setValueAtTime(0.0001, time);
      g.gain.linearRampToValueAtTime(gain, time + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, time + duration);

      osc.connect(g);
      g.connect(master);
      osc.start(time);
      osc.stop(time + duration + 0.05);
    },
    [],
  );

  const motherReverbTail = useCallback(
    (time: number) => {
      motherTone(220, time, 1.2, 0.025, "sine");
      motherTone(330, time + 0.08, 1.4, 0.018, "sine");
      motherTone(440, time + 0.16, 1.6, 0.012, "triangle");
    },
    [motherTone],
  );

  const synthesizeMirageChunk = useCallback(
    async (text: string, voiceTuning: CyberdeckVoiceTuning) => {
      const res = await fetch("/api/cyberdeck-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          voiceTuning: {
            ratePercent: voiceTuning.ratePercent,
            pitchHz: voiceTuning.pitchHz,
            volume: voiceTuning.volume,
            voiceType: voiceTuning.voiceType,
            gender: voiceTuning.gender,
          },
          apiKey: openaiApiKey || "",
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      const isAudio = contentType.startsWith("audio/");
      const isJson = contentType.includes("application/json");

      if (isAudio) {
        lastVoiceErrorRef.current = "";
        const voiceType = res.headers.get("x-muthur-voice-type");
        if (voiceType) {
          console.info("[muthur] voice backend", voiceType, res.headers.get("x-muthur-voice-source"));
        }
        return { kind: "audio" as const, audio: await res.arrayBuffer() };
      }

      if (isJson) {
        const diagnostic = await res.json().catch(() => null);
        if (diagnostic && typeof diagnostic === "object") {
          const diagnosticRecord = diagnostic as Record<string, unknown>;
          const diagnosticKeys = Object.keys(diagnosticRecord);
          if (diagnosticKeys.length === 0) {
            console.warn("[muthur] render diagnostic", {
              status: res.status,
              note: "empty-json",
            });
            if (lastVoiceErrorRef.current !== `empty:${res.status}`) {
              lastVoiceErrorRef.current = `empty:${res.status}`;
            }
            return { kind: "diagnostic" as const, diagnostic: null };
          }

          console.warn("[muthur] render diagnostic", diagnosticRecord);
          const stage =
            typeof (diagnostic as { stage?: unknown }).stage === "string"
              ? (diagnostic as { stage: string }).stage
              : "unknown";
          const message =
            typeof (diagnostic as { message?: unknown }).message === "string"
              ? (diagnostic as { message: string }).message
              : "MUTHUR backend returned a diagnostic";
          const details =
            typeof (diagnostic as { details?: unknown }).details === "string"
              ? (diagnostic as { details: string }).details
              : "";
          const signature = `${res.status}:${stage}:${message}`;
          if (lastVoiceErrorRef.current !== signature) {
            lastVoiceErrorRef.current = signature;
            setMessages((prev) => [
              ...prev,
              {
                role: "system",
                text: `MUTHUR_BACKEND_DIAGNOSTIC // ${stage.toUpperCase()} // ${message} // ${details}`.slice(
                  0,
                  240,
                ),
              },
            ]);
          }
          return { kind: "diagnostic" as const, diagnostic };
        }
      }

      if (lastVoiceErrorRef.current !== String(res.status)) {
        lastVoiceErrorRef.current = String(res.status);
        setMessages((prev) => [
          ...prev,
          { role: "system", text: `VOICE_ENDPOINT_UNAVAILABLE // HTTP_${res.status} // USING_LOCAL_FALLBACK` },
        ]);
      }
      return { kind: "diagnostic" as const, diagnostic: null };
    },
    [openaiApiKey, setMessages],
  );

  const speakMother = useCallback(
    async (text: string) => {
      if (!isAudioAllowed()) return false;
      const speakId = ++speakSequenceRef.current;
      speakQueueActiveRef.current = true;
      stopMirageAudio();
      const currentVoiceDial = voiceDialRef.current;
      const browserTuning = muthurBrowserSpeechTuning(currentVoiceDial);
      try {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }
      } catch {
        /* ignore */
      }

      try {
        const result = await synthesizeMirageChunk(text, buildMuthurVoiceTuning(currentVoiceDial));
        if (speakId !== speakSequenceRef.current) return false;
        if (result.kind === "audio") {
          setVoiceHealth("backend");
          await playMirageBuffer(result.audio);
          if (speakId !== speakSequenceRef.current) return false;
          return true;
        }
        setVoiceHealth("fallback");
        console.warn(
          "[muthur] coderobo unavailable — browser fallback",
          buildMuthurVoiceTuning(currentVoiceDial),
        );
      } catch {
        /* fall through */
      }
      try {
        setVoiceHealth("fallback");
        await (await loadDeckAudio()).speakDryFallback(text, browserTuning);
        if (speakId !== speakSequenceRef.current) return false;
        return true;
      } catch {
        setVoiceHealth("off");
        /* fall through */
      } finally {
        if (speakId === speakSequenceRef.current) {
          speakQueueActiveRef.current = false;
        }
      }
      return false;
    },
    [playMirageBuffer, stopMirageAudio, synthesizeMirageChunk],
  );

  const speakDeckVoiceLine = useCallback<Db8DeckSpeakLine>(
    async (text, profile) => {
      if (!isAudioAllowed()) return;
      await unlockMotherAudio();
      stopMirageAudio();
      try {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }
      } catch {
        /* ignore */
      }

      const tuning: CyberdeckVoiceTuning = {
        ratePercent: profile.ratePercent,
        pitchHz: profile.pitchHz,
        volume: profile.volume,
        voiceType: profile.voiceType,
        gender: profile.gender,
      };

      try {
        const result = await synthesizeMirageChunk(text, tuning);
        if (result.kind === "audio") {
          await playMirageBuffer(result.audio);
          return;
        }
      } catch {
        /* fall through */
      }

      const deckAudio = await loadDeckAudio();
      await deckAudio.speakDryFallback(text, {
        rate: profile.browserRate,
        pitch: profile.browserPitch,
        volume: profile.volume,
      });
    },
    [playMirageBuffer, stopMirageAudio, synthesizeMirageChunk, unlockMotherAudio],
  );

  const abortMotherSpeech = useCallback(() => {
    speakSequenceRef.current += 1;
    stopMirageAudio();
    try {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    } catch {
      /* ignore */
    }
    setVoicePlaybackBusy(false);
  }, [stopMirageAudio]);

  const clearNetworkFeedbackAudio = useCallback(() => {
    if (networkFeedbackRepeatRef.current !== null) {
      window.clearInterval(networkFeedbackRepeatRef.current);
      networkFeedbackRepeatRef.current = null;
    }
    if (networkFeedbackDelayRef.current !== null) {
      window.clearTimeout(networkFeedbackDelayRef.current);
      networkFeedbackDelayRef.current = null;
    }
  }, []);

  useEffect(() => {
    const unregisterMirage = registerAudioStopHook(stopMirageAudio);
    const unregisterNetwork = registerAudioStopHook(clearNetworkFeedbackAudio);
    const unsubscribeGate = subscribeAudioGate(() => {
      if (!isAudioAllowed()) {
        clearNetworkFeedbackAudio();
      }
    });
    return () => {
      unregisterMirage();
      unregisterNetwork();
      unsubscribeGate();
    };
  }, [clearNetworkFeedbackAudio, stopMirageAudio]);

  const speakVoiceBlockAtIndex = useCallback(
    (index: number) => {
      const blocks = assistantVoiceBlocksRef.current;
      if (!blocks.length || index < 0 || index >= blocks.length) return;
      setVoiceBlockFocusIndex(index);
      const line = blocks[index];
      if (!line) return;
      setVoicePlaybackBusy(true);
      void speakMother(line).finally(() => setVoicePlaybackBusy(false));
    },
    [speakMother],
  );

  const replayFullLastAssistant = useCallback(() => {
    const assistants = messages.filter((m) => m.role === "assistant");
    const last = assistants[assistants.length - 1];
    const t = last?.text ? textForSpeech(last.text) : "";
    if (!t) return;
    setVoicePlaybackBusy(true);
    void speakMother(t).finally(() => setVoicePlaybackBusy(false));
  }, [messages, speakMother]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (!voicePlaybackBusy) return;
      e.preventDefault();
      abortMotherSpeech();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [abortMotherSpeech, voicePlaybackBusy]);

  const toggleVoiceEnabled = useCallback(() => {
    const latestAssistantMessage = [...messages].reverse().find((message) => message.role === "assistant");
    setVoiceEnabled((prev) => {
      const next = !prev;
      if (next) {
        setVoiceHealth("idle");
        if (latestAssistantMessage?.text) {
          lastSpokenAssistantTextRef.current = latestAssistantMessage.text;
        }
        void speakMother(MUTHUR_PRESET.testPhrase);
      } else {
        setVoiceHealth("off");
        stopMirageAudio();
      }
      return next;
    });
  }, [messages, speakMother, stopMirageAudio]);

  const saveMuthurVoiceCopyToApp = useCallback(() => {
    saveMuthurVoiceMasterCopy(buildMuthurVoiceMasterCopy(voiceDialRef.current));
    toast.success("Saved MUTHUR voice copy.");
  }, []);

  const restoreMuthurVoiceMaster = useCallback(() => {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm("Restore MUTHUR voice master?");
      if (!confirmed) return;
    }

    const restored = restoreMuthurVoiceMasterCopy();
    setVoiceDial(restored);
    voiceDialRef.current = restored;
    toast.success("Restored MUTHUR master.");
  }, []);

  const playVoiceTest = useCallback(() => {
    if (!voiceEnabled) return;
    void speakMother(MUTHUR_PRESET.testPhrase);
  }, [speakMother, voiceEnabled]);

  useEffect(() => {
    try {
      saveMuthurVoiceMasterCopy(buildMuthurVoiceMasterCopy(voiceDial));
    } catch {
      /* ignore */
    }
  }, [voiceDial]);

  useEffect(() => {
    voiceDialRef.current = voiceDial;
  }, [voiceDial]);

  useEffect(() => {
    const master = motherMasterGainRef.current;
    if (!master) return;
    master.gain.value = muthurMasterGain(voiceDial.volume);
  }, [voiceDial.volume]);

  useEffect(() => {
    setDeckUplinkSonarVolume(sonarVolume);
  }, [sonarVolume]);

  useEffect(() => {
    setDeckSfxVolume(deckSfxVolume);
  }, [deckSfxVolume]);

  const handleVoiceVolumeChange = useCallback((volume: number) => {
    setVoiceDial((prev) => ({ ...prev, volume }));
  }, []);

  const handleSonarVolumeChange = useCallback((volume: number) => {
    setSonarVolume(volume);
    saveUplinkSonarVolume(volume);
  }, []);

  useEffect(() => {
    if (isStreaming && isAudioAllowed()) {
      if (networkFeedbackDelayRef.current == null) {
        networkFeedbackDelayRef.current = window.setTimeout(() => {
          networkFeedbackDelayRef.current = null;
          if (!isAudioAllowed()) return;
          playDeckBleepBloop();
          networkFeedbackRepeatRef.current = window.setInterval(() => {
            if (!isAudioAllowed()) {
              clearNetworkFeedbackAudio();
              return;
            }
            playDeckBleepBloop();
          }, 7000);
        }, 2800);
      }
    } else {
      clearNetworkFeedbackAudio();
    }
    return () => {
      clearNetworkFeedbackAudio();
    };
  }, [clearNetworkFeedbackAudio, isStreaming]);

  useEffect(() => {
    const latest = messages[messages.length - 1];
    if (!latest || latest.role !== "assistant") {
      assistantVoiceBlocksRef.current = [];
      setVoiceBlockTotal(0);
      setVoiceBlockFocusIndex(0);
    }
  }, [messages]);

  useEffect(() => {
    if (!voiceEnabled || isStreaming) return;
    if (speakQueueActiveRef.current) return;
    if (!messages || messages.length === 0) return;
    const latest = messages[messages.length - 1];
    if (!latest || latest.role !== "assistant") return;
    if (latest.text === lastSpokenAssistantTextRef.current) return;
    if (/^Working on that request\b/i.test(latest.text.trim())) return;
    const speechText = textForSpeech(latest.text);
    if (!speechText) return;
    lastSpokenAssistantTextRef.current = latest.text;
    const blocks = splitIntoSpeechBlocks(latest.text);
    assistantVoiceBlocksRef.current = blocks;
    setVoiceBlockTotal(blocks.length);
    const focus = blocks.length ? blocks.length - 1 : 0;
    setVoiceBlockFocusIndex(focus);
    if (motherTerminalRef.current.shouldBurst(speechText)) {
      void motherTerminalRef.current.unlock().then(() => {
        motherTerminalRef.current.playBurstSound(speechText.length);
      });
    }
    setVoicePlaybackBusy(true);
    void speakMother(speechText).finally(() => setVoicePlaybackBusy(false));
  }, [isStreaming, messages, speakMother, voiceEnabled]);

  useEffect(() => {
    if (!voiceEnabled) return;
    const failureCountRef = { current: 0 };
    let removeListener = () => {};
    void loadComputerUse().then((cu) => {
      removeListener = cu.addNarrationListener((narration) => {
        if (!voiceEnabled) return;
        void speakMother(narration.text)
          .then(() => {
            failureCountRef.current = 0;
          })
          .catch(() => {
            failureCountRef.current += 1;
            if (failureCountRef.current >= 3) {
              void abortMotherSpeech();
              failureCountRef.current = 0;
            }
          });
      });
    });
    return () => {
      removeListener();
      void loadComputerUse().then((cu) => cu.resumeAfterStop());
    };
  }, [abortMotherSpeech, speakMother, voiceEnabled]);

  return {
    voiceEnabled,
    voicePlaybackBusy,
    voiceBlockFocusIndex,
    voiceBlockTotal,
    voiceDial,
    sonarVolume,
    deckSfxVolume,
    voiceHealth,
    speakMother,
    speakDeckVoiceLine,
    abortMotherSpeech,
    toggleVoiceEnabled,
    speakVoiceBlockAtIndex,
    replayFullLastAssistant,
    handleDeckSfxVolumeChange,
    handleVoiceVolumeChange,
    handleSonarVolumeChange,
    saveMuthurVoiceCopyToApp,
    restoreMuthurVoiceMaster,
    playVoiceTest,
    setVoiceDial,
  };
}
