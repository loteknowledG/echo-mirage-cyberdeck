"use client";

import { PreviewMatrix } from "@/app/preview/preview-matrix";
import "@/app/preview/preview-matrix.css";
import type { PreviewDeckWithTarget } from "@/app/preview/preview-data";

export type DeckMatrixEmbedSurface = "rola-dex" | "survey";

type DeckMatrixEmbedProps = {
  className?: string;
  embedSurface?: DeckMatrixEmbedSurface;
  decks?: PreviewDeckWithTarget[];
  onDeckCommand?: (command: string) => Promise<{ ok: boolean; message: string }>;
};

/** Shared PreviewMatrix wrapper for Rola Dex and Survey PowerFist deck surfaces. */
export function DeckMatrixEmbed({
  className = "",
  embedSurface = "rola-dex",
  decks,
  onDeckCommand,
}: DeckMatrixEmbedProps) {
  return (
    <div className={`powerfist-preview-layout min-h-0 w-full overflow-hidden ${className}`.trim()}>
      <PreviewMatrix embedSurface={embedSurface} decks={decks} onDeckCommand={onDeckCommand} />
    </div>
  );
}
