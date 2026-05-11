"use client";

import {
  CyberdeckPaneHeader,
  CyberdeckPaneHeaderSubtitle,
  CyberdeckPaneHeaderTitle,
} from "@/components/cyberdeck/pane-header";
import { Knob } from "@/components/ui/knob";
import { Switch } from "@/components/ui/switch";

type VoiceLabPaneBodyProps = {
  voiceEnabled: boolean;
  onVoiceToggle: () => void;
  muthurMasterVolume: number;
  onMuthurMasterVolumeChange: (volume: number) => void;
};

export function CyberdeckVoiceLabPaneBody({
  voiceEnabled,
  onVoiceToggle,
  muthurMasterVolume,
  onMuthurMasterVolumeChange,
}: VoiceLabPaneBodyProps) {
  return (
    <div className="custom-scrollbar flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-black p-3">
      <div className="flex min-h-0 flex-1 flex-col rounded-sm border border-[#141414] bg-black transition-colors">
        <CyberdeckPaneHeader
          left={
            <div className="flex flex-col">
              <CyberdeckPaneHeaderTitle style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}>
                VOICE LAB
              </CyberdeckPaneHeaderTitle>
              <CyberdeckPaneHeaderSubtitle>MUTHUR CHANNEL // SYNTH CONTROL</CyberdeckPaneHeaderSubtitle>
            </div>
          }
        />
        <div className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 font-mono text-[10px]">
          <div className="rounded-sm border border-[#1c1c1c] bg-black/80 p-3 text-[#8e8e8e]">
            PROFILE: <span className="text-[#cfcfcf]">mechanicus-voice</span>
          </div>
          <div className="rounded-sm border border-[#1c1c1c] bg-black/80 p-3">
            <div className="mb-2 text-[9px] tracking-[0.08em] text-[#8a8a8a]">MASTER GAIN</div>
            <Knob
              label="VOL"
              unit="%"
              min={5}
              max={125}
              step={1}
              value={Math.round(muthurMasterVolume * 100)}
              onValueChange={(v) => onMuthurMasterVolumeChange(v / 100)}
              mode="power"
              size="sm"
              theme="dark"
              className="[&_legend]:font-mono [&_legend]:text-[9px] [&_legend]:tracking-[0.08em] [&_legend]:text-[#6a6a6a]"
            />
          </div>
          <div className="rounded-sm border border-[#1c1c1c] bg-black/80 p-3">
            <div className="mb-2 text-[9px] tracking-[0.08em] text-[#8a8a8a]">VOICE ENABLE</div>
            <Switch checked={voiceEnabled} onCheckedChange={onVoiceToggle} aria-label="Toggle cyberdeck voice" />
          </div>
          <div className="rounded-sm border border-[#1c1c1c] bg-black/80 p-3 text-[#9a9a9a]">
            RATE_SLOT: <span className="text-[#d0d0d0]">1.00x (visual)</span>
            <br />
            PITCH_SLOT: <span className="text-[#d0d0d0]">0.92 (visual)</span>
            <br />
            HARMONIC_WASH: <span className="text-[#d0d0d0]">ENABLED (visual)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
