"use client";

import { cn } from "@/lib/utils";

export const OBSERVE_PRESENCE_GLYPH = "(𓁹 𓁹)";
export const OBSERVE_TRANSCRIPT_PREFIX = `${OBSERVE_PRESENCE_GLYPH} [OBSERVE]`;

type ObservePresenceGlyphProps = {
  active: boolean;
  className?: string;
  subsystemLabel?: string;
  scopeLabel?: string;
};

export function ObservePresenceGlyph({
  active,
  className,
}: ObservePresenceGlyphProps) {
  if (!active) return null;

  return (
    <span
      className={cn("observe-presence-glyph", className)}
      data-testid="observe-presence-glyph"
      data-observing="true"
      tabIndex={0}
      title="observe"
      aria-label={`${OBSERVE_PRESENCE_GLYPH} observe presence active`}
    >
      <span className="observe-presence-glyph__compact" aria-hidden="true">
        {OBSERVE_PRESENCE_GLYPH}
      </span>
    </span>
  );
}
