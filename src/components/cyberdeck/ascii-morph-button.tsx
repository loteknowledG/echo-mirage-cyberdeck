"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import {
  renderAsciiMorphFace,
  renderAsciiMorphShadowBottom,
  renderAsciiMorphShadowSide,
} from "@/lib/ascii-morph-button-art";
import { cn } from "@/lib/utils";

export type AsciiMorphButtonSize =
  | "micro"
  | "compact"
  | "toolbar"
  | "icon"
  | "send"
  | "action"
  | "filter"
  | "wide"
  | "menu"
  | "tile";

export type AsciiMorphButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Single-character rail glyph mode. */
  glyph?: string;
  /** Text label mode — box width follows label length. */
  label?: string;
  /** Fixed interior column count for empty/icon overlay boxes. */
  cols?: number;
  isPushed?: boolean;
  size?: AsciiMorphButtonSize;
  children?: ReactNode;
};

function artOptions({
  glyph,
  label,
  cols,
}: Pick<AsciiMorphButtonProps, "glyph" | "label" | "cols">) {
  if (glyph) return { cols: 3, label: glyph.slice(0, 1) };
  if (label) return { label };
  return { cols: cols ?? 3 };
}

function isTextLabel(children: ReactNode): children is string {
  return typeof children === "string" && children.trim().length > 0;
}

/** Stationary ASCII shadow + lifting face — pane chrome toolbars (not rail). */
export function AsciiMorphButton({
  glyph,
  label,
  cols,
  isPushed = false,
  size = "toolbar",
  className,
  children,
  type = "button",
  ...props
}: AsciiMorphButtonProps) {
  const textLabel = label ?? (isTextLabel(children) ? children.trim() : undefined);
  const iconOverlay = !glyph && !textLabel && children != null;
  const options = artOptions({ glyph, label: textLabel, cols });
  const face = renderAsciiMorphFace(options);
  const shadowSide = renderAsciiMorphShadowSide(options);
  const shadowBottom = renderAsciiMorphShadowBottom(options);

  return (
    <button
      type={type}
      className={cn(
        "ascii-morph-btn",
        `ascii-morph-btn--${size}`,
        isPushed && "is-pushed",
        className,
      )}
      {...props}
    >
      <div className="ascii-morph-btn-stack">
        {!isPushed ? (
          <div className="ascii-morph-btn-shadow-stack" aria-hidden>
            <pre className="ascii-morph-btn-shadow-side">{shadowSide}</pre>
            <pre className="ascii-morph-btn-shadow-bottom">{shadowBottom}</pre>
          </div>
        ) : null}
        {glyph || textLabel ? (
          <pre className="ascii-morph-btn-face">{face}</pre>
        ) : (
          <div className="ascii-morph-btn-face">
            <pre className="ascii-morph-btn-frame">{face}</pre>
            {iconOverlay ? <span className="ascii-morph-btn-content">{children}</span> : null}
          </div>
        )}
      </div>
    </button>
  );
}
