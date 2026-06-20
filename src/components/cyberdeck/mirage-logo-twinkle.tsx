"use client";

import { AsciiLogoTwinkle } from "@/components/cyberdeck/ascii-logo-twinkle";
import { MIRAGE_LOGO_ASCII } from "@/lib/cyberdeck/mirage-logo-art";

type MirageLogoTwinkleProps = {
  className?: string;
  seedOffset?: number;
};

export function MirageLogoTwinkle({ className, seedOffset = 17 }: MirageLogoTwinkleProps) {
  return (
    <AsciiLogoTwinkle
      ascii={MIRAGE_LOGO_ASCII}
      ariaLabel="Mirage logo"
      className={className}
      seedOffset={seedOffset}
    />
  );
}
