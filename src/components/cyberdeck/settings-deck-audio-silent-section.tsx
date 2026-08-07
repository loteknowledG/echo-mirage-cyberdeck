"use client";

import { Switch } from "@/components/ui/switch";
import { emitSignal } from "@/lib/cyberdeck/signal-router";
import { useDeckAudioSilentMode } from "@/lib/cyberdeck/use-deck-audio-silent-mode";
import { cn } from "@/lib/utils";

const SWITCH_LEGACY_EMERALD =
  "data-[state=checked]:border-emerald-500/70 data-[state=checked]:bg-emerald-500/10 data-[state=unchecked]:border-[#2d2d2d] data-[state=unchecked]:bg-[#0c0c0c]";

/** Deck-wide mute toggle — nested inside the DECK AUDIO settings panel. */
export function SettingsDeckAudioSilentSection() {
  const { silent, setSilent } = useDeckAudioSilentMode();

  return (
    <div className="flex items-center justify-between gap-3 border-t border-[#1c1c1c] pt-3">
      <div className="min-w-0">
        <div className="text-[9px] tracking-[0.06em] text-[#8a8a8a]">SILENT MODE</div>
        <div className="mt-0.5 text-[9px] tracking-[0.04em] text-[#5f5f5f]">
          Suppress all deck audio — speech, keyboard SFX, sonar, and alerts.
        </div>
      </div>
      <Switch
        checked={silent}
        onCheckedChange={(checked) => {
          setSilent(checked);
          emitSignal({
            source: "settings",
            type: "updated",
            payload: { key: "deck_audio_silent", value: checked },
            severity: "info",
          });
        }}
        aria-label={silent ? "Silent mode on" : "Silent mode off"}
        className={cn("realmorphism-switch shrink-0", SWITCH_LEGACY_EMERALD)}
      />
    </div>
  );
}
