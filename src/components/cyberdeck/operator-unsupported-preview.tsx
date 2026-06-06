"use client";

import { CyberdeckActionButton } from "@/components/cyberdeck/cyberdeck-control-button";

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
  return (
    <div className="rounded-sm border border-amber-800/50 bg-black/90 p-4">
      <div className="font-mono text-[10px] tracking-[0.08em] text-amber-300/95">{title}</div>
      <p className="mt-2 font-mono text-[10px] leading-snug text-[#9a9a9a]">{message}</p>
      <p className="mt-2 truncate font-mono text-[9px] text-[#5a5a5a]">{fileName}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {onPreview ? (
          <CyberdeckActionButton variant="neutral" onClick={onPreview}>
            {previewLabel}
          </CyberdeckActionButton>
        ) : null}
        {onConvertToMarkdown ? (
          <CyberdeckActionButton variant="accent" disabled={converting} onClick={onConvertToMarkdown}>
            {converting ? "CONVERTING..." : "CONVERT TO MARKDOWN"}
          </CyberdeckActionButton>
        ) : null}
      </div>
    </div>
  );
}
