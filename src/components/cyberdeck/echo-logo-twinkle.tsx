"use client";

import { useCallback, useEffect, useState } from "react";
import { AsciiLogoTwinkle } from "@/components/cyberdeck/ascii-logo-twinkle";
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

type EchoLogoTwinkleProps = {
  className?: string;
  seedOffset?: number;
};

export function EchoLogoTwinkle({ className, seedOffset = 0 }: EchoLogoTwinkleProps) {
  const { pickerFonts } = useFigletFontCatalog();
  const [mode, setMode] = useState<EchoHeaderLogoMode>(() => readEchoHeaderLogoMode());
  const [render, setRender] = useState<EchoHeaderLogoRender>(() => classicEchoHeaderLogo());
  const [rerollNonce, setRerollNonce] = useState(0);

  const loadLogo = useCallback(
    async (nextMode: EchoHeaderLogoMode, fontOverride?: string) => {
      if (nextMode === "classic") {
        const classic = classicEchoHeaderLogo();
        setRender(classic);
        window.dispatchEvent(
          new CustomEvent(ECHO_HEADER_LOGO_RENDERED_EVENT, { detail: classic }),
        );
        return;
      }

      const resolved = await resolveDynamicEchoHeaderLogo(pickerFonts, { fontOverride });
      setRender(resolved);
      window.dispatchEvent(
        new CustomEvent(ECHO_HEADER_LOGO_RENDERED_EVENT, { detail: resolved }),
      );
    },
    [pickerFonts],
  );

  useEffect(() => {
    void loadLogo(mode);
  }, [loadLogo, mode, rerollNonce]);

  useEffect(() => {
    const onModeChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ mode?: EchoHeaderLogoMode }>).detail;
      const nextMode = detail?.mode ?? readEchoHeaderLogoMode();
      setMode(nextMode);
    };
    const onReroll = () => {
      setRerollNonce((value) => value + 1);
    };

    window.addEventListener(ECHO_HEADER_LOGO_MODE_CHANGED_EVENT, onModeChanged);
    window.addEventListener(ECHO_HEADER_LOGO_REROLL_EVENT, onReroll);
    return () => {
      window.removeEventListener(ECHO_HEADER_LOGO_MODE_CHANGED_EVENT, onModeChanged);
      window.removeEventListener(ECHO_HEADER_LOGO_REROLL_EVENT, onReroll);
    };
  }, []);

  const ariaLabel =
    mode === "classic"
      ? "Echo Mirage logo"
      : `Echo Mirage logo (${render.font} figlet)`;

  return (
    <AsciiLogoTwinkle
      ascii={render.ascii}
      ariaLabel={ariaLabel}
      className={className}
      seedOffset={seedOffset}
    />
  );
}
