"use client";

import { useCallback, useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { DepthButton } from "@/components/realmorphism";
import { emitSignal } from "@/lib/cyberdeck/signal-router";
import {
  ECHO_HEADER_LOGO_MODE_CHANGED_EVENT,
  ECHO_HEADER_LOGO_RENDERED_EVENT,
  readEchoHeaderLogoMode,
  requestEchoHeaderLogoReroll,
  writeEchoHeaderLogoMode,
  type EchoHeaderLogoMode,
} from "@/lib/cyberdeck/echo-header-logo-preference.client";
import type { EchoHeaderLogoRender } from "@/lib/cyberdeck/echo-header-logo-render.client";
import { cn } from "@/lib/utils";

const SWITCH_LEGACY_EMERALD =
  "data-[state=checked]:border-emerald-500/70 data-[state=checked]:bg-emerald-500/10 data-[state=unchecked]:border-[#2d2d2d] data-[state=unchecked]:bg-[#0c0c0c]";

export function SettingsEchoHeaderSection() {
  const [mode, setMode] = useState<EchoHeaderLogoMode>(() => readEchoHeaderLogoMode());
  const [render, setRender] = useState<EchoHeaderLogoRender | null>(null);

  useEffect(() => {
    const onModeChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ mode?: EchoHeaderLogoMode }>).detail;
      setMode(detail?.mode ?? readEchoHeaderLogoMode());
    };
    const onRendered = (event: Event) => {
      const detail = (event as CustomEvent<EchoHeaderLogoRender>).detail;
      if (detail) setRender(detail);
    };

    window.addEventListener(ECHO_HEADER_LOGO_MODE_CHANGED_EVENT, onModeChanged);
    window.addEventListener(ECHO_HEADER_LOGO_RENDERED_EVENT, onRendered);
    return () => {
      window.removeEventListener(ECHO_HEADER_LOGO_MODE_CHANGED_EVENT, onModeChanged);
      window.removeEventListener(ECHO_HEADER_LOGO_RENDERED_EVENT, onRendered);
    };
  }, []);

  const dynamicEnabled = mode === "dynamic";

  const setDynamicEnabled = useCallback((enabled: boolean) => {
    const nextMode: EchoHeaderLogoMode = enabled ? "dynamic" : "classic";
    writeEchoHeaderLogoMode(nextMode);
    setMode(nextMode);
    emitSignal({
      source: "settings",
      type: "updated",
      payload: { key: "echo_header_logo_mode", value: nextMode },
      severity: "info",
    });
  }, []);

  const reroll = useCallback(() => {
    requestEchoHeaderLogoReroll();
    emitSignal({
      source: "settings",
      type: "updated",
      payload: { key: "echo_header_logo_reroll", value: true },
      severity: "info",
    });
  }, []);

  return (
    <section className="flex flex-col gap-2">
      <div className="font-mono text-[10px] tracking-[0.06em] text-[#8a8a8a]">ECHO HEADER</div>
      <div className="rounded-sm border border-[#1c1c1c] bg-black/75 p-3 font-mono text-[10px] leading-relaxed tracking-[0.04em] text-[#707070]">
        <p className="mb-3">
          The Echo column banner can pick a random figlet font on load, or stay on the classic{" "}
          <span className="text-[#9a9a9a]">Impossible</span> art you have today.
        </p>
        <div className="flex items-center justify-between gap-3 border-t border-[#1c1c1c] pt-3">
          <div className="min-w-0">
            <div className="text-[9px] tracking-[0.06em] text-[#8a8a8a]">RANDOM FIGLET</div>
            <div className="mt-0.5 text-[9px] tracking-[0.04em] text-[#5f5f5f]">
              {dynamicEnabled
                ? render?.source === "figlet"
                  ? `Showing ${render.font} · reroll or reload for another.`
                  : "New random font each reroll / reload."
                : "Classic Impossible banner locked in."}
            </div>
          </div>
          <Switch
            checked={dynamicEnabled}
            onCheckedChange={setDynamicEnabled}
            aria-label={dynamicEnabled ? "Random figlet header on" : "Classic Impossible header"}
            className={cn("realmorphism-switch shrink-0", SWITCH_LEGACY_EMERALD)}
          />
        </div>
        {dynamicEnabled ? (
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#1c1c1c] pt-3">
            <div className="min-w-0 text-[9px] tracking-[0.04em] text-[#5f5f5f]">
              Not feeling the current font? Reroll without leaving random mode.
            </div>
            <DepthButton type="button" depth={6} onClick={reroll}>
              REROLL
            </DepthButton>
          </div>
        ) : null}
      </div>
    </section>
  );
}
