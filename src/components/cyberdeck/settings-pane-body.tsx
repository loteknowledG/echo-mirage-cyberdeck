'use client';

import {
  CyberdeckPaneHeader,
  CyberdeckPaneHeaderSubtitle,
  CyberdeckPaneHeaderTitle,
} from "@/components/cyberdeck/pane-header";
import { Switch } from "@/components/ui/switch";
import { emitSignal } from "@/lib/cyberdeck/signal-router";
import type { Identity } from "@/lib/identity/identity-types";
import { cn } from "@/lib/utils";
import { DepthButton, DepthPanel } from "@/components/realmorphism";
import { SettingsAppUpdateSection } from "@/components/cyberdeck/settings-app-update-section";
import { MuthurComposerAudioKnobs } from "@/components/cyberdeck/muthur-composer-audio-knobs";

const SWITCH_LEGACY_EMERALD =
  "data-[state=checked]:border-emerald-500/70 data-[state=checked]:bg-emerald-500/10 data-[state=unchecked]:border-[#2d2d2d] data-[state=unchecked]:bg-[#0c0c0c]";

type CyberdeckSettingsPaneBodyProps = {
  voiceEnabled: boolean;
  onVoiceToggle: () => void;
  audioMuted: boolean;
  onAudioMuteToggle: () => void;
  identity: Identity | null;
  voiceVolume: number;
  onVoiceVolumeChange: (volume: number) => void;
  sonarVolume: number;
  onSonarVolumeChange: (volume: number) => void;
};

/** SETTINGS rail / `settings` command surface. */
export function CyberdeckSettingsPaneBody({
  voiceEnabled,
  onVoiceToggle,
  audioMuted,
  onAudioMuteToggle,
  identity,
  voiceVolume,
  onVoiceVolumeChange,
  sonarVolume,
  onSonarVolumeChange,
}: CyberdeckSettingsPaneBodyProps) {
  return (
    <div className="custom-scrollbar flex flex-1 flex-col overflow-y-auto bg-black p-4">
      <div className="flex min-h-0 flex-1 flex-col rounded-sm border border-[#141414] bg-black transition-colors">
        <CyberdeckPaneHeader
          left={
            <div className="flex flex-col">
              <CyberdeckPaneHeaderTitle style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}>
                SETTINGS
              </CyberdeckPaneHeaderTitle>
              <CyberdeckPaneHeaderSubtitle>CONFIG PLANE // LOCAL PARAMETERS</CyberdeckPaneHeaderSubtitle>
            </div>
          }
        />
        <div className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 py-4">
          <section className="flex flex-col gap-2">
            <div className="font-mono text-[10px] tracking-[0.06em] text-[#8a8a8a]">VOICE</div>
            <div className="rounded-sm border border-[#1c1c1c] bg-black/75 p-3 font-mono text-[10px] leading-relaxed tracking-[0.04em] text-[#707070]">
              <p className="mb-3">
                Cyberdeck routes assistant replies through{" "}
                <span className="text-[#9a9a9a]">MUTHUR</span> in-browser speech (effects chain + preset in{" "}
                <span className="text-[#9a9a9a]">src/voice/muthurPreset.ts</span>). When off, playback stops and
                diagnostics report OFF.
              </p>
              <p className="mb-3">
                Archive or restore the locked preset with{" "}
                <code className="rounded border border-[#2d2d2d] bg-black px-1 py-0.5 text-[9px] text-[#8a8a8a]">
                  pnpm voice:save
                </code>{" "}
                /{" "}
                <code className="rounded border border-[#2d2d2d] bg-black px-1 py-0.5 text-[9px] text-[#8a8a8a]">
                  pnpm voice:restore
                </code>
                . Full notes: <span className="text-[#9a9a9a]">docs/MUTHUR_VOICE.md</span>.
              </p>
              <p className="mb-3">
                Optional Cursor IDE hook TTS (Mechanicus): try{" "}
                <code className="rounded border border-[#2d2d2d] bg-black px-1 py-0.5 text-[9px] text-[#8a8a8a]">
                  pnpm voice:cursor:read-last-response:dry
                </code>
                ; IDE hook voice label is one line in{" "}
                <span className="text-[#9a9a9a]">.cursor/hooks/cursor-tts-voice.txt</span> (e.g. warp-spider).
              </p>
              <div className="flex items-center justify-between gap-3 border-t border-[#1c1c1c] pt-3">
                <div className="min-w-0">
                  <div className="text-[9px] tracking-[0.06em] text-[#8a8a8a]">CYBERDECK SPEECH</div>
                  <div className="mt-0.5 text-[9px] tracking-[0.04em] text-[#5f5f5f]">
                    Speak assistant replies in-browser when enabled.
                  </div>
                </div>
                <Switch
                  checked={voiceEnabled}
                  onCheckedChange={() => {
                    onVoiceToggle();
                    emitSignal({
                      source: "settings",
                      type: "updated",
                      payload: { key: "voice_enabled", value: !voiceEnabled },
                      severity: "info",
                    });
                  }}
                  aria-label={voiceEnabled ? "Cyberdeck speech on" : "Cyberdeck speech off"}
                  className={cn("realmorphism-switch shrink-0", SWITCH_LEGACY_EMERALD)}
                />
              </div>
            </div>
          </section>
          <section className="flex flex-col gap-2">
            <div className="font-mono text-[10px] tracking-[0.06em] text-[#8a8a8a]">DECK AUDIO</div>
            <div className="rounded-sm border border-[#1c1c1c] bg-black/75 p-3 font-mono text-[10px] leading-relaxed tracking-[0.04em] text-[#707070]">
              <div className="mb-4 border-b border-[#1c1c1c] pb-4">
                <div className="mb-3 text-[9px] tracking-[0.06em] text-[#8a8a8a]">LEVELS</div>
                <p className="mb-3 text-[9px] leading-relaxed tracking-[0.04em] text-[#5f5f5f]">
                  MUTHUR voice output and uplink bleep bloop cue. Drag or scroll a dial to adjust.
                </p>
                <MuthurComposerAudioKnobs
                  compact={false}
                  voiceVolume={voiceVolume}
                  onVoiceVolumeChange={onVoiceVolumeChange}
                  sonarVolume={sonarVolume}
                  onSonarVolumeChange={onSonarVolumeChange}
                  className="justify-start gap-4"
                />
              </div>
<div className="flex items-center justify-between gap-3 border-t border-[#1c1c1c] pt-3 first:border-t-0 first:pt-0">
                <div className="min-w-0">
                  <div className="text-[9px] tracking-[0.06em] text-[#8a8a8a]">AUDIO OUTPUT</div>
                  <div className="mt-0.5 text-[9px] tracking-[0.04em] text-[#5f5f5f]">
                    Live: SFX allowed. Muted: full silence.
                  </div>
                </div>
                <Switch
                  checked={!audioMuted}
                  onCheckedChange={() => {
                    onAudioMuteToggle();
                  }}
                  aria-label={audioMuted ? "Unmute deck audio" : "Mute deck audio"}
                  className={cn("realmorphism-switch shrink-0", SWITCH_LEGACY_EMERALD)}
                />
              </div>
            </div>
          </section>
          <SettingsAppUpdateSection />
          <section className="flex flex-col gap-2">
            <div className="font-mono text-[10px] tracking-[0.06em] text-[#8a8a8a]">DEPTH PANEL LAB</div>
            <div data-deck-mode="ascii" className="max-w-md">
              <div className="cyberdeck-message-box rounded-sm border border-[#1c1c1c] bg-black p-0">
                <DepthPanel variant="module" depth={8} className="w-full">
                  <div className="space-y-3 p-3 font-mono text-[10px] leading-relaxed tracking-[0.04em]">
                    <div className="text-[9px] tracking-[0.06em] text-[#8a8a8a]">MECHANICAL DEPTH PRIMITIVE</div>
                    <p className="text-[9px] leading-relaxed tracking-[0.04em] text-[#5f5f5f]">
                      Asciimorphism — square mechanical depth (same as MUTHUR composer). Front face +
                      right/bottom walls; press to latch.
                    </p>
                    <div className="flex flex-wrap items-end gap-4 pt-1">
                      <DepthButton posture="signal" depth={4} asciiOverlay>
                        CONNECT
                      </DepthButton>
                      <DepthPanel variant="inset" depth={6} className="min-w-[7rem]">
                        <div className="px-2 py-1.5 text-[9px] tracking-[0.06em] text-[#8a8a8a]">INSET</div>
                      </DepthPanel>
                    </div>
                  </div>
                </DepthPanel>
              </div>
            </div>
          </section>
          <section className="flex flex-col gap-2">
            <div className="font-mono text-[10px] tracking-[0.06em] text-[#8a8a8a]">OPERATOR IDENTITY</div>
            <div className="rounded-sm border border-[#1c1c1c] bg-black/75 p-3 font-mono text-[10px] leading-relaxed tracking-[0.04em] text-[#707070]">
              {identity ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-[#5f5f5f]">ID</span>
                    <span className="text-[9px] text-[#9a9a9a]">{identity.agent_id}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-[#5f5f5f]">NAME</span>
                    <span className="text-[9px] text-[#9a9a9a]">{identity.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-[#5f5f5f]">ROLE</span>
                    <span className="text-[9px] text-[#9a9a9a]">{identity.role}</span>
                  </div>
                </div>
              ) : (
                <div className="text-[9px] text-[#5f5f5f]">No identity loaded</div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
