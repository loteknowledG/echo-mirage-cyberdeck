"use client";

import { Switch } from "@/components/ui/switch";
import { emitSignal } from "@/lib/cyberdeck/signal-router";
import { useSilentModeSetting } from "@/lib/electron/silent-mode";
import { cn } from "@/lib/utils";

const SWITCH_LEGACY_EMERALD =
  "data-[state=checked]:border-emerald-500/70 data-[state=checked]:bg-emerald-500/10 data-[state=unchecked]:border-[#2d2d2d] data-[state=unchecked]:bg-[#0c0c0c]";

/** Electron-only tray-resident mode (L-ECHO-TRAY-001). */
export function SettingsSilentModeSection() {
  const { available, enabled, hydrated, setEnabled } = useSilentModeSetting();

  if (!available) {
    return null;
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="font-mono text-[10px] tracking-[0.06em] text-[#8a8a8a]">DESKTOP SHELL</div>
      <div className="rounded-sm border border-[#1c1c1c] bg-black/75 p-3 font-mono text-[10px] leading-relaxed tracking-[0.04em] text-[#707070]">
        <p className="mb-3 text-[9px] leading-relaxed tracking-[0.04em] text-[#5f5f5f]">
          Keep Echo Mirage running in the system tray only. Hide from taskbar until restored. The tray
          icon always exposes Open and Quit — this is tray-resident mode, not a hidden background
          process.
        </p>
        <div className="flex items-center justify-between gap-3 border-t border-[#1c1c1c] pt-3">
          <div className="min-w-0">
            <div className="text-[9px] tracking-[0.06em] text-[#8a8a8a]">SILENT MODE</div>
            <div className="mt-0.5 text-[9px] tracking-[0.04em] text-[#5f5f5f]">
              Keep Echo Mirage running in the system tray only. Hide from taskbar until restored.
            </div>
          </div>
          <Switch
            checked={enabled}
            disabled={!hydrated}
            onCheckedChange={(checked) => {
              void setEnabled(checked);
              emitSignal({
                source: "settings",
                type: "updated",
                payload: { key: "silent_mode", value: checked },
                severity: "info",
              });
            }}
            aria-label={enabled ? "Silent mode on" : "Silent mode off"}
            className={cn("realmorphism-switch shrink-0", SWITCH_LEGACY_EMERALD)}
          />
        </div>
      </div>
    </section>
  );
}
