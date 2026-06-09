"use client";

import { cn } from "@/lib/utils";

export const OBSERVE_PRESENCE_GLYPH = "(𓁹 𓁹)";
export const OBSERVE_TRANSCRIPT_PREFIX = `${OBSERVE_PRESENCE_GLYPH} [OBSERVE]`;

type ObservePresenceGlyphProps = {
  active: boolean;
  state?: "idle" | "thinking" | "speaking" | "critical";
  className?: string;
  subsystemLabel?: string;
  scopeLabel?: string;
};

export function ObservePresenceGlyph({
  active,
  state = "idle",
  className,
}: ObservePresenceGlyphProps) {
  if (!active) return null;

  const resolvedState = state ?? "idle";

  return (
    <span
      className={cn("observe-presence-glyph", className, `observe-presence-glyph--${resolvedState}`)}
      data-testid="observe-presence-glyph"
      data-observing="true"
      data-muthur-state={resolvedState}
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
