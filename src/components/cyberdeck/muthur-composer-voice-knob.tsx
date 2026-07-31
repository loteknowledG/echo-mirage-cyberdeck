"use client";

import { Knob } from "@/components/ui/knob";
import { CyberdeckControlTooltip } from "@/components/cyberdeck/cyberdeck-pane-tooltip";
import { cn } from "@/lib/utils";

type MuthurComposerVoiceKnobProps = {
  voiceEnabled: boolean;
  voiceHealth: "idle" | "backend" | "fallback" | "off";
  voiceVolume: number;
  onVoiceToggle: () => void;
  onVoiceVolumeChange: (volume: number) => void;
  className?: string;
};

function clampVoiceVolume(volume: number) {
  return Math.min(1.25, Math.max(0.05, volume));
}

export function MuthurComposerVoiceKnob({
  voiceEnabled,
  voiceHealth,
  voiceVolume,
  onVoiceToggle,
  onVoiceVolumeChange,
  className,
}: MuthurComposerVoiceKnobProps) {
  const volumeLabel = Math.round(clampVoiceVolume(voiceVolume) * 100);
  const healthHint =
    voiceHealth === "fallback"
      ? " · browser fallback"
      : voiceHealth === "backend"
        ? " · TTS backend"
        : "";

  const tooltip = voiceEnabled
    ? `Voice on · ${volumeLabel}%${healthHint} · click to mute · drag for volume`
    : `Voice off · click to enable · drag sets level for next on`;

  return (
    <CyberdeckControlTooltip label={tooltip}>
      <div
        className={cn("origin-bottom scale-[0.72]", className)}
        style={{ touchAction: "none" }}
        onPointerDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <Knob
          label="VOICE"
          unit="%"
          min={5}
          max={125}
          step={1}
          value={volumeLabel}
          onValueChange={(next) => onVoiceVolumeChange(clampVoiceVolume(next / 100))}
          wheelMultiplier={1.2}
          dragMultiplier={1.5}
          size="sm"
          theme="dark"
          mode="power"
          clickTogglesActive
          active={voiceEnabled}
          onActiveChange={(active) => {
            if (active !== voiceEnabled) {
              onVoiceToggle();
            }
          }}
          showReadout={false}
          showLabel
          className="w-14"
        />
      </div>
    </CyberdeckControlTooltip>
  );
}
