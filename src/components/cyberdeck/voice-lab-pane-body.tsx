"use client";

import { useState } from "react";

import {
  CyberdeckPaneHeader,
  CyberdeckPaneHeaderSubtitle,
  CyberdeckPaneHeaderTitle,
} from "@/components/cyberdeck/pane-header";
import { Knob } from "@/components/ui/knob";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { MUTHUR_PRESET } from "@/voice/muthurPreset";
import type { MuthurVoiceDialState } from "@/voice/muthurVoiceSettings";

const SWITCH_LEGACY_EMERALD =
  "data-[state=checked]:bg-emerald-600 data-[state=unchecked]:bg-[#2a2a2a]";

type VoiceHealth = "idle" | "backend" | "fallback" | "off";

type VoiceLabPaneBodyProps = {
  voiceEnabled: boolean;
  voiceHealth: VoiceHealth;
  voiceDial: MuthurVoiceDialState;
  onVoiceToggle: () => void;
  onVoiceDialChange: (next: MuthurVoiceDialState) => void;
  onVoiceTest: () => void;
  onSpeakPreview: (text: string) => void;
};

function clampVolume(volume: number) {
  return Math.min(1.25, Math.max(0.05, volume));
}

function clampRatePercent(ratePercent: number) {
  return Math.min(0, Math.max(-40, ratePercent));
}

function clampPitchHz(pitchHz: number) {
  return Math.min(0, Math.max(-20, pitchHz));
}

export function CyberdeckVoiceLabPaneBody({
  voiceEnabled,
  voiceHealth,
  voiceDial,
  onVoiceToggle,
  onVoiceDialChange,
  onVoiceTest,
  onSpeakPreview,
}: VoiceLabPaneBodyProps) {
  const [previewText, setPreviewText] = useState("");
  const volumePct = Math.round(clampVolume(voiceDial.volume) * 100);

  return (
    <div className="custom-scrollbar flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-black p-3">
      <div className="flex min-h-0 flex-1 flex-col rounded-sm border border-[#141414] bg-black transition-colors">
        <CyberdeckPaneHeader
          left={
            <div className="flex flex-col">
              <CyberdeckPaneHeaderTitle style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}>
                VOICE LAB
              </CyberdeckPaneHeaderTitle>
              <CyberdeckPaneHeaderSubtitle>
                MUTHUR CHANNEL // SYNTH CONTROL
              </CyberdeckPaneHeaderSubtitle>
            </div>
          }
        />
        <div className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3 font-mono text-[10px]">
          <section className="rounded-sm border border-[#1c1c1c] bg-black/80 p-3">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[9px] tracking-[0.08em] text-[#8a8a8a]">IN-DECK MUTHUR</div>
                <div className="mt-0.5 text-[9px] tracking-[0.04em] text-[#5f5f5f]">
                  Speaks assistant replies in the cyberdeck chat column.
                </div>
              </div>
              <Switch
                checked={voiceEnabled}
                onCheckedChange={() => onVoiceToggle()}
                aria-label={voiceEnabled ? "MUTHUR voice on" : "MUTHUR voice off"}
                className={cn("realmorphism-switch shrink-0", SWITCH_LEGACY_EMERALD)}
              />
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px] tracking-[0.06em] text-[#5f5f5f]">
              <span>
                HEALTH <span className="text-[#9a9a9a]">{voiceHealth.toUpperCase()}</span>
              </span>
              <span>
                LEVEL <span className="text-[#9a9a9a]">{volumePct}%</span>
              </span>
              <span>
                RATE <span className="text-[#9a9a9a]">{voiceDial.ratePercent}</span>
              </span>
              <span>
                PITCH <span className="text-[#9a9a9a]">{voiceDial.pitchHz} Hz</span>
              </span>
            </div>

            <div className="mb-4 flex flex-wrap items-end gap-4">
              <div
                style={{ touchAction: "none" }}
                onPointerDown={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
                title={`MUTHUR voice ${volumePct}%`}
              >
                <Knob
                  label="LEVEL"
                  unit="%"
                  min={5}
                  max={125}
                  step={1}
                  value={volumePct}
                  onValueChange={(next) =>
                    onVoiceDialChange({ ...voiceDial, volume: clampVolume(next / 100) })
                  }
                  wheelMultiplier={1.2}
                  dragMultiplier={1.5}
                  size="sm"
                  theme="dark"
                  showReadout={false}
                  showLabel
                  className="w-16"
                  disabled={!voiceEnabled}
                />
              </div>
              <div
                style={{ touchAction: "none" }}
                onPointerDown={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
                title={`Rate ${voiceDial.ratePercent}`}
              >
                <Knob
                  label="RATE"
                  unit=""
                  min={-40}
                  max={0}
                  step={1}
                  value={voiceDial.ratePercent}
                  onValueChange={(next) =>
                    onVoiceDialChange({ ...voiceDial, ratePercent: clampRatePercent(next) })
                  }
                  wheelMultiplier={1.2}
                  dragMultiplier={1.5}
                  size="sm"
                  theme="dark"
                  showReadout={false}
                  showLabel
                  className="w-16"
                  disabled={!voiceEnabled}
                />
              </div>
              <div
                style={{ touchAction: "none" }}
                onPointerDown={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
                title={`Pitch ${voiceDial.pitchHz} Hz`}
              >
                <Knob
                  label="PITCH"
                  unit="Hz"
                  min={-20}
                  max={0}
                  step={1}
                  value={voiceDial.pitchHz}
                  onValueChange={(next) =>
                    onVoiceDialChange({ ...voiceDial, pitchHz: clampPitchHz(next) })
                  }
                  wheelMultiplier={1.2}
                  dragMultiplier={1.5}
                  size="sm"
                  theme="dark"
                  showReadout={false}
                  showLabel
                  className="w-16"
                  disabled={!voiceEnabled}
                />
              </div>
              <button
                type="button"
                disabled={!voiceEnabled}
                onClick={onVoiceTest}
                className="rounded-sm border border-[#2a2a2a] bg-[#0a0a0a] px-3 py-2 text-[9px] tracking-[0.1em] text-[#9a9a9a] transition-colors hover:border-[#3a3a3a] hover:text-[#c8c8c8] disabled:cursor-not-allowed disabled:opacity-40"
              >
                TEST SPEAK
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[9px] tracking-[0.06em] text-[#8a8a8a]" htmlFor="voice-lab-preview">
                PREVIEW
              </label>
              <div className="flex flex-wrap items-stretch gap-2">
                <input
                  id="voice-lab-preview"
                  type="text"
                  value={previewText}
                  disabled={!voiceEnabled}
                  placeholder={MUTHUR_PRESET.testPhrase}
                  onChange={(event) => setPreviewText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    const text = previewText.trim() || MUTHUR_PRESET.testPhrase;
                    onSpeakPreview(text);
                  }}
                  className="min-w-0 flex-1 rounded-sm border border-[#2a2a2a] bg-[#0a0a0a] px-2 py-1.5 text-[10px] tracking-[0.04em] text-[#b0b0b0] outline-none placeholder:text-[#4a4a4a] focus:border-[#3a3a3a] disabled:opacity-40"
                />
                <button
                  type="button"
                  disabled={!voiceEnabled}
                  onClick={() => {
                    const text = previewText.trim() || MUTHUR_PRESET.testPhrase;
                    onSpeakPreview(text);
                  }}
                  className="rounded-sm border border-[#2a2a2a] bg-[#0a0a0a] px-3 py-1.5 text-[9px] tracking-[0.1em] text-[#9a9a9a] transition-colors hover:border-[#3a3a3a] hover:text-[#c8c8c8] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  SPEAK
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
