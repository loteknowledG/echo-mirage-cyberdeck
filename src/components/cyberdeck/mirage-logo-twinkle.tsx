"use client";

import { AsciiLogoTwinkle } from "@/components/cyberdeck/ascii-logo-twinkle";
import { useCyberdeckHeaderLogo } from "@/lib/cyberdeck/use-cyberdeck-header-logo";

type MirageLogoTwinkleProps = {
  className?: string;
  seedOffset?: number;
};

export function MirageLogoTwinkle({ className, seedOffset = 17 }: MirageLogoTwinkleProps) {
  const { render, mode } = useCyberdeckHeaderLogo();
  const ariaLabel = mode === "classic" ? "Mirage logo" : `Mirage logo (${render.font} figlet)`;

  return (
    <AsciiLogoTwinkle
      ascii={render.mirageAscii}
      ariaLabel={ariaLabel}
      className={className}
      seedOffset={seedOffset}
    />
  );
}
