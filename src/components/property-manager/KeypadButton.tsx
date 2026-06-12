"use client";

import { art } from "@/lib/TerminalArt";
import { keypadSubLabel } from "@/lib/property-manager/call-sessions";
import { cn } from "@/lib/utils";

type KeypadButtonProps = {
  digit: string;
  letters?: string;
  disabled?: boolean;
  onPress: (digit: string) => void;
};

/** Dialer keypad — tab-rail ASCII stack; digit + letter markings live inside the face box. */
export function KeypadButton({ digit, letters, disabled, onPress }: KeypadButtonProps) {
  const sub = keypadSubLabel(digit, letters);
  const glyph = digit.slice(0, 1);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPress(digit)}
      aria-label={sub ? `${digit}, ${sub}` : digit}
      className={cn("ascii-btn dialer-keypad-btn", !disabled && "is-signal")}
    >
      <div className="ascii-btn-stack">
        <pre className="ascii-btn-shadow" aria-hidden>
          {art.dialerKeyShadow(glyph, sub)}
        </pre>
        <pre className="ascii-btn-face">{art.dialerKeyFace(glyph, sub)}</pre>
      </div>
    </button>
  );
}
