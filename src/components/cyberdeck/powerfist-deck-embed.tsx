"use client";

import { PreviewMatrix } from "@/app/preview/preview-matrix";
import "@/app/preview/preview-matrix.css";

type PowerfistDeckEmbedProps = {
  className?: string;
  embedSurface?: "rola-dex" | "survey";
};

/** Embedded PowerFist / Rola Dex card matrix (same surface as the MIRAGE rail pane). */
export function PowerfistDeckEmbed({
  className = "",
  embedSurface = "rola-dex",
}: PowerfistDeckEmbedProps) {
  return (
    <div className={`powerfist-preview-layout min-h-0 w-full overflow-hidden ${className}`.trim()}>
      <PreviewMatrix embedSurface={embedSurface} />
    </div>
  );
}
