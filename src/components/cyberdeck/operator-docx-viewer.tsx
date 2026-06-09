"use client";

import { useEffect, useRef, useState } from "react";
import { fetchOperatorDocxBlob } from "@/lib/operator-binary-preview";
import { sanitizeDocxBlobForPreview } from "@/lib/operator-docx-sanitize";
import {
  fitOperatorDocxPreview,
  scheduleOperatorDocxPreviewFit,
} from "@/lib/operator-docx-preview-layout";

type OperatorDocxViewerProps = {
  uri: string;
  fileName: string;
  className?: string;
};

/** Read-only DOCX preview (client-side via docx-preview-sync). */
export function OperatorDocxViewer({ uri, fileName, className }: OperatorDocxViewerProps) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const styleRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const body = bodyRef.current;
    const style = styleRef.current;
    if (!body || !style) return;

    let cancelled = false;
    let cancelFit = () => {};
    body.replaceChildren();
    style.replaceChildren();
    setLoading(true);
    setError(null);

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => fitOperatorDocxPreview(body))
        : null;
    resizeObserver?.observe(body);

    void (async () => {
      try {
        const blob = await fetchOperatorDocxBlob(uri);
        if (cancelled) return;
        const safeBlob = await sanitizeDocxBlobForPreview(blob);
        if (cancelled) return;
        const { renderAsync } = await import("docx-preview");
        if (cancelled) return;
        await renderAsync(safeBlob, body, style, {
          className: "operator-docx-preview",
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: true,
          useBase64URL: true,
          experimental: true,
        });
        if (cancelled) return;
        cancelFit = scheduleOperatorDocxPreviewFit(body);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not render DOCX preview.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      cancelFit();
      resizeObserver?.disconnect();
    };
  }, [uri, fileName]);

  if (error) {
    return (
      <div className="rounded-sm border border-red-900/60 bg-black p-4 font-mono text-[10px] leading-snug text-red-200">
        <div className="mb-2 text-red-300">DOCX VIEW // FAILED</div>
        <div className="text-[#9a9a9a]">{error}</div>
      </div>
    );
  }

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${className ?? ""}`.trim()} data-testid="operator-docx-viewer">
      {loading ? (
        <div className="border border-[#1c1c1c] bg-black px-3 py-2 font-mono text-[10px] text-[#8a8a8a]">
          Loading DOCX preview…
        </div>
      ) : null}
      <div ref={styleRef} className="operator-docx-preview-styles" aria-hidden />
      <div
        ref={bodyRef}
        className="operator-docx-preview-body min-h-0 flex-1 overflow-auto rounded-sm border border-[#1c1c1c] bg-[#0a0a0a] p-2"
        style={{ minHeight: "50vh" }}
      />
    </div>
  );
}
