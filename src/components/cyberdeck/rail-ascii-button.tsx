"use client";

import type { CSSProperties, MouseEvent } from "react";
import { art } from "@/lib/TerminalArt";

type RailAsciiButtonProps = {
  glyph: string;
  isPushed: boolean;
  className: string;
  onClick: (event: MouseEvent<HTMLDivElement>) => void;
  style?: CSSProperties;
};

/** Stationary ASCII shadow (ground) + lifting face on hover. */
export function RailAsciiButton({
  glyph,
  isPushed,
  className,
  onClick,
  style,
}: RailAsciiButtonProps) {
  return (
    <div className={className} onClick={onClick} style={style}>
      <div className="ascii-btn-stack">
        {!isPushed ? <pre className="ascii-btn-shadow">{art.poppedShadow(glyph)}</pre> : null}
        <pre className="ascii-btn-face">
          {isPushed ? art.pushed(glyph) : art.poppedFace(glyph)}
        </pre>
      </div>
    </div>
  );
}
