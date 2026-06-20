"use client";

import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { art } from "@/lib/TerminalArt";

type RailAsciiButtonProps = {
  glyph: string;
  /** Centered overlay (e.g. Cadre GiDarkSquad) inside the ASCII frame. */
  icon?: ReactNode;
  isPushed: boolean;
  className: string;
  onClick: (event: MouseEvent<HTMLDivElement>) => void;
  style?: CSSProperties;
};

/** Stationary ASCII shadow (ground) + lifting face on hover. */
export function RailAsciiButton({
  glyph,
  icon,
  isPushed,
  className,
  onClick,
  style,
}: RailAsciiButtonProps) {
  const iconMode = icon != null;

  return (
    <div className={className} onClick={onClick} style={style}>
      <div className="ascii-btn-stack">
        {!isPushed ? (
          <pre className="ascii-btn-shadow">
            {iconMode ? art.iconShadow() : art.poppedShadow(glyph)}
          </pre>
        ) : null}
        <div className={cn("ascii-btn-face-shell", iconMode && "ascii-btn-face-shell--icon")}>
          <pre className="ascii-btn-face">
            {iconMode ? art.iconFace() : isPushed ? art.pushed(glyph) : art.poppedFace(glyph)}
          </pre>
          {icon ? <span className="ascii-btn-icon">{icon}</span> : null}
        </div>
      </div>
    </div>
  );
}
