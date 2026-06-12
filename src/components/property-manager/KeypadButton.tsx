"use client";

import { AsciiMorphButton } from "@/components/cyberdeck/ascii-morph-button";
import { keypadLetters } from "@/lib/property-manager/call-sessions";
import { cn } from "@/lib/utils";

type KeypadButtonProps = {
  digit: string;
  letters?: string;
  disabled?: boolean;
  compact?: boolean;
  onPress: (digit: string) => void;
};

export function KeypadButton({ digit, letters, disabled, compact = false, onPress }: KeypadButtonProps) {
  const sub = letters ?? keypadLetters(digit);
  const glyph = digit.slice(0, 1);

  return (
    <div
      className={cn(
        "flex flex-col items-center",
        compact ? "gap-0" : "gap-0.5",
      )}
    >
      <AsciiMorphButton
        type="button"
        glyph={glyph}
        size={compact ? "compact" : "tile"}
        disabled={disabled}
        onClick={() => onPress(digit)}
        className={cn("dialer-keypad-btn", !disabled && "is-signal")}
        aria-label={sub ? `${digit}, ${sub}` : digit}
      />
      {sub && !compact ? (
        <span className="font-mono text-[6px] tracking-[0.14em] text-[#5a6a60]">{sub}</span>
      ) : (
        <span className="h-[9px]" aria-hidden />
      )}
    </div>
  );
}
