"use client";

import { AsciiLogoTwinkle } from "@/components/cyberdeck/ascii-logo-twinkle";
import { useCyberdeckHeaderLogo } from "@/lib/cyberdeck/use-cyberdeck-header-logo";

type EchoLogoTwinkleProps = {
  className?: string;
  seedOffset?: number;
};

export function EchoLogoTwinkle({ className, seedOffset = 0 }: EchoLogoTwinkleProps) {
  const { render, mode } = useCyberdeckHeaderLogo();
  const ariaLabel = mode === "classic" ? "Echo logo" : `Echo logo (${render.font} figlet)`;

  return (
    <AsciiLogoTwinkle
      ascii={render.echoAscii}
      ariaLabel={ariaLabel}
      className={className}
      seedOffset={seedOffset}
    />
  );
}
