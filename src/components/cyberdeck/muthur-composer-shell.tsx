"use client";

import type { ReactNode } from "react";
import { DepthPanel } from "@/components/realmorphism";
import type { DeckMode } from "@/lib/deck-mode";
import { cn } from "@/lib/utils";

type MuthurComposerShellProps = {
  deckMode: DeckMode;
  children: ReactNode;
  className?: string;
};

/** MUTHUR input band — rounded realmorphism chrome or ascii mechanical inset. */
export function MuthurComposerShell({ deckMode, children, className }: MuthurComposerShellProps) {
  if (deckMode === "ascii") {
    return (
      <DepthPanel
        variant="inset"
        depth={6}
        className={cn("muthur-composer-inset muthur-composer-shell min-h-0 flex-1", className)}
        faceClassName="flex h-full min-h-0 flex-col"
      >
        {children}
      </DepthPanel>
    );
  }

  return (
    <div
      className={cn(
        "muthur-composer-shell flex h-full min-h-0 flex-1 flex-col rounded-sm border border-green-900/70 bg-black transition-colors transition-shadow focus-within:border-green-500/80 focus-within:shadow-[0_0_0_1px_rgba(34,197,94,0.45),0_0_18px_rgba(34,197,94,0.2)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
