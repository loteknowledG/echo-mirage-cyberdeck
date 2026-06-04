"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDeckMode } from "@/lib/deck-mode";
import { isElectronOperatorBridge } from "@/lib/operator-binary-preview";
import { realmorphismActionClass } from "@/lib/cyberdeck/realmorphism-control";

type OperatorPdfPreviewProps = {
  fileName: string;
  pdfSrc?: string;
  localFilePath?: string;
  onConvertToMarkdown?: () => void;
  converting?: boolean;
};

export function OperatorPdfPreview({
  fileName,
  pdfSrc,
  localFilePath,
  onConvertToMarkdown,
  converting = false,
}: OperatorPdfPreviewProps) {
  const deckMode = useDeckMode();
  const [loadError, setLoadError] = useState(false);
  const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLoadError(false);
    if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
    if (!pdfSrc) return;

    loadTimerRef.current = setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch(pdfSrc);
          if (!response.ok) {
            setLoadError(true);
            return;
          }
          const bytes = await response.arrayBuffer();
          const header = new Uint8Array(bytes.slice(0, 4));
          const isPdf =
            header.length >= 4 &&
            header[0] === 0x25 &&
            header[1] === 0x50 &&
            header[2] === 0x44 &&
            header[3] === 0x46;
          if (!isPdf) setLoadError(true);
        } catch {
          setLoadError(true);
        }
      })();
    }, 400);

    return () => {
      if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
    };
  }, [pdfSrc]);

  const openInSystemViewer = useCallback(async () => {
    if (!localFilePath) return;
    const bridge = window.echoMirageOpen;
    if (!bridge?.openPath) return;
    const result = await bridge.openPath(localFilePath);
    if (!result.ok) {
      setLoadError(true);
    }
  }, [localFilePath]);

  const previewClassName = "block h-[min(65vh,480px)] w-full bg-[#1a1a1a]";

  return (
    <div className="rounded-sm border border-[#1c1c1c] bg-black/80 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="font-mono text-[9px] tracking-[0.08em] text-[#8a8a8a]">PDF PREVIEW</div>
        <div className="flex flex-wrap gap-2">
          {localFilePath && isElectronOperatorBridge() ? (
            <button
              type="button"
              onClick={() => void openInSystemViewer()}
              className={realmorphismActionClass(deckMode, "neutral")}
            >
              OPEN IN VIEWER
            </button>
          ) : null}
          {onConvertToMarkdown ? (
            <button
              type="button"
              disabled={converting}
              onClick={onConvertToMarkdown}
              className={realmorphismActionClass(deckMode, "accent")}
            >
              {converting ? "CONVERTING…" : "CONVERT TO MARKDOWN"}
            </button>
          ) : null}
        </div>
      </div>
      {pdfSrc && !loadError ? (
        <div
          className="overflow-hidden rounded-sm border border-[#1c1c1c] bg-[#0a0a0a]"
          style={{ minHeight: "min(65vh, 480px)" }}
        >
          <iframe
            title={`PDF preview: ${fileName}`}
            src={pdfSrc}
            className={previewClassName}
            onError={() => setLoadError(true)}
          />
        </div>
      ) : (
        <div className="rounded-sm border border-dashed border-[#1c1c1c] bg-black p-4 font-mono text-[10px] leading-snug text-[#8a8a8a]">
          {loadError
            ? "PDF preview could not render in-pane. Use Open in Viewer or Convert to Markdown."
            : "Could not load PDF preview."}
        </div>
      )}
    </div>
  );
}
