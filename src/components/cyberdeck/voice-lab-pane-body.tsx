"use client";

import dynamic from "next/dynamic";

import {
  CyberdeckPaneHeader,
  CyberdeckPaneHeaderSubtitle,
  CyberdeckPaneHeaderTitle,
} from "@/components/cyberdeck/pane-header";
import { Switch } from "@/components/ui/switch";

const VoiceFlowPanel = dynamic(
  () => import("@/components/voice-studio/voice-flow-panel").then((m) => m.VoiceFlowPanel),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-sm border border-[#1c1c1c] bg-black/80 p-3 font-mono text-[10px] text-[#8e8e8e]">
        Loading voice studio…
      </div>
    ),
  },
);

type VoiceLabPaneBodyProps = {
  voiceEnabled: boolean;
  onVoiceToggle: () => void;
};

export function CyberdeckVoiceLabPaneBody({
  voiceEnabled,
  onVoiceToggle,
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
              <CyberdeckPaneHeaderSubtitle>
                MUTHUR CHANNEL // SYNTH CONTROL // CURSOR HOOKS
              </CyberdeckPaneHeaderSubtitle>
            </div>
          }
        />
        <div className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 font-mono text-[10px]">
          <div className="rounded-sm border border-[#1c1c1c] bg-black/80 p-3">
            <div className="mb-2 text-[9px] tracking-[0.08em] text-[#8a8a8a]">
              IN-DECK MUTHUR VOICE
            </div>
            <Switch checked={voiceEnabled} onCheckedChange={onVoiceToggle} aria-label="Toggle cyberdeck voice" />
          </div>
          <VoiceFlowPanel compact />
        </div>
      </div>
    </div>
  );
}
