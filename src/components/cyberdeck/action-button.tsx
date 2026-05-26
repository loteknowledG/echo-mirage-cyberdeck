'use client';

import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import { useDeckMode } from "@/lib/deck-mode";
import {
  realmorphismActionClass,
  type RealmorphismActionVariant,
} from "@/lib/cyberdeck/realmorphism-control";
import { cn } from "@/lib/utils";

type CyberdeckActionButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: RealmorphismActionVariant;
  }
>;

export function CyberdeckActionButton({
  variant = "neutral",
  className = "",
  children,
  ...props
}: CyberdeckActionButtonProps) {
  const deckMode = useDeckMode();

  return (
    <button
      type="button"
      className={cn(realmorphismActionClass(deckMode, variant), className)}
      {...props}
    >
      {children}
    </button>
  );
}
