"use client";

import { AsciiLogoTwinkle } from "@/components/cyberdeck/ascii-logo-twinkle";
import { ECHO_MIRAGE_LOGO_ASCII } from "@/lib/cyberdeck/echo-logo-art";

type EchoLogoTwinkleProps = {
  className?: string;
  seedOffset?: number;
};

export function EchoLogoTwinkle({ className, seedOffset = 0 }: EchoLogoTwinkleProps) {
  return (
    <AsciiLogoTwinkle
      ascii={ECHO_MIRAGE_LOGO_ASCII}
      ariaLabel="Echo Mirage logo"
      className={className}
      seedOffset={seedOffset}
    />
  );
}
