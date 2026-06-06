"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { DepthButton } from "@/components/realmorphism";
import { useDeckMode, type DeckMode } from "@/lib/deck-mode";
import {
  deckDepthFaceClass,
  deckDepthPosture,
} from "@/lib/cyberdeck/deck-depth-control";
import {
  realmorphismControlClass,
  type RealmorphismActionVariant,
  type RealmorphismControlOptions,
} from "@/lib/cyberdeck/realmorphism-control";
import { cn } from "@/lib/utils";

function depthForControl({ size = "icon" }: Pick<RealmorphismControlOptions, "size">): number {
  if (size === "micro") return 3;
  if (size === "wide" || size === "menu" || size === "tile") return 3;
  return 4;
}

function isFullWidthControl({ size = "icon", menu }: RealmorphismControlOptions): boolean {
  return size === "wide" || size === "menu" || size === "tile" || Boolean(menu);
}

export type CyberdeckControlButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  deckMode: DeckMode;
  control: RealmorphismControlOptions;
  children: ReactNode;
  depth?: number;
  glow?: boolean;
};

/** Content-zone control — realmorphism shadow face, or ascii mechanical depth. */
export function CyberdeckControlButton({
  deckMode,
  control,
  children,
  depth,
  glow = false,
  className,
  type = "button",
  ...props
}: CyberdeckControlButtonProps) {
  if (deckMode === "ascii") {
    const resolvedDepth = depth ?? depthForControl(control);
    return (
      <DepthButton
        type={type}
        depth={resolvedDepth}
        posture={deckDepthPosture(control)}
        glow={glow}
        asciiOverlay
        className={cn(
          "deck-depth-control",
          "muthur-depth-control",
          isFullWidthControl(control) && "block w-full",
          control.off && "is-off",
          className,
        )}
        faceClassName={deckDepthFaceClass(control)}
        {...props}
      >
        {children}
      </DepthButton>
    );
  }

  return (
    <button
      type={type}
      className={cn(realmorphismControlClass(deckMode, control), className)}
      {...props}
    >
      {children}
    </button>
  );
}

/** Same as CyberdeckControlButton — reads deck mode from context. */
export function CyberdeckControl({
  control,
  children,
  depth,
  glow,
  className,
  ...props
}: Omit<CyberdeckControlButtonProps, "deckMode">) {
  const deckMode = useDeckMode();
  return (
    <CyberdeckControlButton
      deckMode={deckMode}
      control={control}
      depth={depth}
      glow={glow}
      className={className}
      {...props}
    >
      {children}
    </CyberdeckControlButton>
  );
}

export function CyberdeckActionButton({
  variant = "neutral",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: RealmorphismActionVariant;
}) {
  const deckMode = useDeckMode();
  return (
    <CyberdeckControlButton
      deckMode={deckMode}
      control={{
        size: "action",
        signal: variant === "accent",
        danger: variant === "danger",
      }}
      className={className}
      {...props}
    >
      {children}
    </CyberdeckControlButton>
  );
}

export function CyberdeckFilterButton({
  active,
  tone = "signal",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  active: boolean;
  tone?: "signal" | "amber";
}) {
  const deckMode = useDeckMode();
  return (
    <CyberdeckControlButton
      deckMode={deckMode}
      control={{
        size: "filter",
        signal: active && tone === "signal",
        amber: active && tone === "amber",
      }}
      aria-pressed={active}
      className={className}
      {...props}
    >
      {children}
    </CyberdeckControlButton>
  );
}

export function CyberdeckMenuButton({
  danger = false,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }) {
  const deckMode = useDeckMode();
  return (
    <CyberdeckControlButton
      deckMode={deckMode}
      control={{ size: "menu", menu: true, danger }}
      depth={3}
      className={cn("w-full", className)}
      {...props}
    >
      {children}
    </CyberdeckControlButton>
  );
}

/** @deprecated Use CyberdeckControlButton */
export const MuthurControlButton = CyberdeckControlButton;
