"use client";

import { Knob } from "@/components/ui/knob";
import { knobToSonarScale, sonarScaleToKnob } from "@/lib/cyberdeck/uplink-sonar-volume";
import { cn } from "@/lib/utils";

type MuthurComposerAudioKnobsProps = {
  voiceVolume: number;
  onVoiceVolumeChange: (volume: number) => void;
  sonarVolume: number;
  onSonarVolumeChange: (volume: number) => void;
  compact?: boolean;
  className?: string;
};

function clampVoiceVolume(volume: number) {
  return Math.min(1.25, Math.max(0.05, volume));
}

export function MuthurComposerAudioKnobs({
  voiceVolume,
  onVoiceVolumeChange,
  sonarVolume,
  onSonarVolumeChange,
  compact = true,
  className,
}: MuthurComposerAudioKnobsProps) {
  const knobShellClass = compact ? "origin-bottom scale-[0.72]" : "";
  const knobClass = compact ? "w-14" : "w-16";

  return (
    <div className={cn("flex items-end gap-1.5", className)}>
      <div
        className={knobShellClass}
        style={{ touchAction: "none" }}
        onPointerDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        title={`MUTHUR voice ${Math.round(clampVoiceVolume(voiceVolume) * 100)}%`}
      >
        <Knob
          label="MUTHUR"
          unit="%"
          min={5}
          max={125}
          step={1}
          value={Math.round(clampVoiceVolume(voiceVolume) * 100)}
          onValueChange={(next) => onVoiceVolumeChange(clampVoiceVolume(next / 100))}
          wheelMultiplier={1.2}
          dragMultiplier={1.5}
          size="sm"
          theme="dark"
          showReadout={false}
          showLabel
          className={knobClass}
        />
      </div>
      <div
        className={knobShellClass}
        style={{ touchAction: "none" }}
        onPointerDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        title={`Uplink bleep bloop ${sonarScaleToKnob(sonarVolume)}%`}
      >
        <Knob
          label="UPLINK"
          unit="%"
          min={0}
          max={100}
          step={1}
          value={sonarScaleToKnob(sonarVolume)}
          onValueChange={(next) => onSonarVolumeChange(knobToSonarScale(next))}
          wheelMultiplier={1.2}
          dragMultiplier={1.5}
          size="sm"
          theme="dark"
          showReadout={false}
          showLabel
          className={knobClass}
        />
      </div>
    </div>
  );
}
