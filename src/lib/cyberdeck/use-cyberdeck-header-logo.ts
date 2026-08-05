"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  ECHO_HEADER_LOGO_MODE_CHANGED_EVENT,
  ECHO_HEADER_LOGO_REROLL_EVENT,
  ECHO_HEADER_LOGO_RENDERED_EVENT,
  readEchoHeaderLogoMode,
  type EchoHeaderLogoMode,
} from "@/lib/cyberdeck/echo-header-logo-preference.client";
import {
  classicEchoHeaderLogo,
  resolveDynamicEchoHeaderLogo,
  type EchoHeaderLogoRender,
} from "@/lib/cyberdeck/echo-header-logo-render.client";
import { useFigletFontCatalog } from "@/lib/use-figlet-font-catalog";

let sharedRender: EchoHeaderLogoRender = classicEchoHeaderLogo();
const listeners = new Set<() => void>();
let loadGeneration = 0;

function publishRender(render: EchoHeaderLogoRender) {
  sharedRender = render;
  for (const listener of listeners) {
    listener();
  }
  window.dispatchEvent(new CustomEvent(ECHO_HEADER_LOGO_RENDERED_EVENT, { detail: render }));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return sharedRender;
}

export function useCyberdeckHeaderLogo() {
  const { pickerFonts } = useFigletFontCatalog();
  const render = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [mode, setMode] = useState<EchoHeaderLogoMode>(() => readEchoHeaderLogoMode());

  const loadLogo = useCallback(
    async (nextMode: EchoHeaderLogoMode) => {
      setMode(nextMode);
      const generation = ++loadGeneration;

      if (nextMode === "classic") {
        if (generation !== loadGeneration) return;
        publishRender(classicEchoHeaderLogo());
        return;
      }

      const resolved = await resolveDynamicEchoHeaderLogo(pickerFonts);
      if (generation !== loadGeneration) return;
      publishRender(resolved);
    },
    [pickerFonts],
  );

  useEffect(() => {
    void loadLogo(readEchoHeaderLogoMode());
  }, [loadLogo]);

  useEffect(() => {
    const onModeChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ mode?: EchoHeaderLogoMode }>).detail;
      void loadLogo(detail?.mode ?? readEchoHeaderLogoMode());
    };
    const onReroll = () => {
      void loadLogo(readEchoHeaderLogoMode());
    };

    window.addEventListener(ECHO_HEADER_LOGO_MODE_CHANGED_EVENT, onModeChanged);
    window.addEventListener(ECHO_HEADER_LOGO_REROLL_EVENT, onReroll);
    return () => {
      window.removeEventListener(ECHO_HEADER_LOGO_MODE_CHANGED_EVENT, onModeChanged);
      window.removeEventListener(ECHO_HEADER_LOGO_REROLL_EVENT, onReroll);
    };
  }, [loadLogo]);

  return { render, mode };
}
