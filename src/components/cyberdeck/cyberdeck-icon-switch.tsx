"use client";

import type { ReactNode } from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";
import { useDeckMode } from "@/lib/deck-mode";
import { LEGACY_SWITCH_EMERALD } from "@/lib/cyberdeck/realmorphism-control";
import { cn } from "@/lib/utils";

export type CyberdeckIconSwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Icon anchored to the left half of the track (e.g. view / eye). */
  leftIcon?: ReactNode;
  /** Icon anchored to the right half of the track (e.g. edit / pencil). */
  rightIcon?: ReactNode;
  /** Single icon — always rendered on whichever side is not covered by the thumb. */
  icon?: ReactNode;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
};

/** Switch — colored thumb on the active side, current-mode icon on the empty track side. */
export function CyberdeckIconSwitch({
  checked,
  onCheckedChange,
  leftIcon,
  rightIcon,
  icon,
  ariaLabel,
  disabled = false,
  className,
}: CyberdeckIconSwitchProps) {
  const deckMode = useDeckMode();
  const inactiveLeft = checked;
  const inactiveRight = !checked;

  // Dual icons: show the active mode's icon on the inactive (empty) half.
  const leftSlot = icon ? (inactiveLeft ? icon : null) : inactiveLeft ? rightIcon : null;
  const rightSlot = icon ? (inactiveRight ? icon : null) : inactiveRight ? leftIcon : null;

  return (
    <SwitchPrimitives.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        "cyberdeck-icon-switch realmorphism-switch peer relative inline-flex shrink-0 cursor-pointer items-center",
        "[--switch-travel:calc(2.75rem-1.25rem-4px)]",
        "h-6 w-11 rounded-[2px] border border-[#2d2d2d] bg-[#090909] p-[2px]",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_1px_6px_rgba(0,0,0,0.65)]",
        "transition-all duration-150 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:border-emerald-500/70 data-[state=checked]:bg-emerald-500/10",
        deckMode === "ascii" && "cyberdeck-icon-switch--ascii",
        deckMode === "realmorphism" && LEGACY_SWITCH_EMERALD,
        className,
      )}
    >
      <span
        className={cn(
          "cyberdeck-icon-switch__slot cyberdeck-icon-switch__slot--left",
          "pointer-events-none absolute left-[2px] z-10 flex size-5 items-center justify-center text-[#8a8a8a]",
          leftSlot && "text-emerald-300",
        )}
        aria-hidden
      >
        {leftSlot}
      </span>
      <span
        className={cn(
          "cyberdeck-icon-switch__slot cyberdeck-icon-switch__slot--right",
          "pointer-events-none absolute right-[2px] z-10 flex size-5 items-center justify-center text-[#8a8a8a]",
          rightSlot && "text-emerald-300",
        )}
        aria-hidden
      >
        {rightSlot}
      </span>
      <SwitchPrimitives.Thumb
        className={cn(
          "cyberdeck-icon-switch__thumb",
          "pointer-events-none block size-5 shrink-0 rounded-[1px] border border-[#444]",
          "bg-gradient-to-b from-[#5c5c5c] via-[#3a3a3a] to-[#242424]",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_1px_2px_rgba(0,0,0,0.6)]",
          "ring-0 transition-transform duration-150 ease-out",
          "data-[state=checked]:translate-x-[var(--switch-travel)]",
          "data-[state=checked]:border-emerald-400/50",
          "data-[state=checked]:bg-gradient-to-b data-[state=checked]:from-emerald-200 data-[state=checked]:via-emerald-400 data-[state=checked]:to-emerald-700",
          "data-[state=unchecked]:translate-x-0",
        )}
      />
    </SwitchPrimitives.Root>
  );
}
