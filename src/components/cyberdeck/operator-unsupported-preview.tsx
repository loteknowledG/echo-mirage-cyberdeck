"use client";

import { useDeckMode } from "@/lib/deck-mode";
import { realmorphismActionClass } from "@/lib/cyberdeck/realmorphism-control";

type OperatorUnsupportedPreviewProps = {
  title: string;
  message: string;
  fileName: string;
  onConvertToMarkdown?: () => void;
  onPreview?: () => void;
  converting?: boolean;
  previewLabel?: string;
};

export function OperatorUnsupportedPreview({
  title,
  message,
  fileName,
  onConvertToMarkdown,
  onPreview,
  converting = false,
  previewLabel = "PREVIEW",
}: OperatorUnsupportedPreviewProps) {
  const deckMode = useDeckMode();

  return (
    <div className="rounded-sm border border-amber-800/50 bg-black/90 p-4">
      <div className="font-mono text-[10px] tracking-[0.08em] text-amber-300/95">{title}</div>
      <p className="mt-2 font-mono text-[10px] leading-snug text-[#9a9a9a]">{message}</p>
      <p className="mt-2 truncate font-mono text-[9px] text-[#5a5a5a]">{fileName}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {onPreview ? (
          <button type="button" onClick={onPreview} className={realmorphismActionClass(deckMode, "neutral")}>
            {previewLabel}
          </button>
        ) : null}
        {onConvertToMarkdown ? (
          <button type="button" disabled={converting} onClick={onConvertToMarkdown} className={realmorphismActionClass(deckMode, "accent")}>
            {converting ? "CONVERTING..." : "CONVERT TO MARKDOWN"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
