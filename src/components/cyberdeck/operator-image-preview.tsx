"use client";

import { useEffect, useState } from "react";
import {
  fetchOperatorBinaryBlob,
  revokeOperatorBlobUrl,
  toEchoMirageFileUrl,
} from "@/lib/operator-binary-preview";

type OperatorImagePreviewProps = {
  src?: string;
  alt: string;
  localFilePath?: string;
  zoom: number;
  className?: string;
};

/** Resolves echo-mirage-file and other non-img-safe URLs to blob URLs for display. */
export function OperatorImagePreview({
  src,
  alt,
  localFilePath,
  zoom,
  className,
}: OperatorImagePreviewProps) {
  const [displaySrc, setDisplaySrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let blobUrl: string | null = null;
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(false);
      setDisplaySrc(null);

      const candidates = [src, localFilePath ? toEchoMirageFileUrl(localFilePath) : null].filter(
        (value): value is string => Boolean(value?.trim()),
      );

      if (candidates.length === 0) {
        setLoading(false);
        setError(true);
        return;
      }

      for (const candidate of candidates) {
        if (candidate.startsWith("blob:") || candidate.startsWith("data:")) {
          if (cancelled) return;
          setDisplaySrc(candidate);
          setLoading(false);
          return;
        }

        try {
          const blob = await fetchOperatorBinaryBlob(candidate);
          if (cancelled) return;
          blobUrl = URL.createObjectURL(blob);
          setDisplaySrc(blobUrl);
          setLoading(false);
          return;
        } catch {
          /* try next candidate */
        }
      }

      if (!cancelled) {
        setError(true);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      revokeOperatorBlobUrl(blobUrl);
    };
  }, [localFilePath, src]);

  if (loading) {
    return (
      <div className="rounded-sm border border-[#1c1c1c] bg-black p-4 font-mono text-[10px] text-[#8a8a8a]">
        Loading image preview…
      </div>
    );
  }

  if (error || !displaySrc) {
    return (
      <div className="rounded-sm border border-dashed border-[#1c1c1c] bg-black p-4 font-mono text-[10px] leading-snug text-[#8a8a8a]">
        Could not load image preview.
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-sm border border-[#1c1c1c] bg-black" style={{ maxHeight: "65vh" }}>
      <img
        src={displaySrc}
        alt={alt}
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: "top left",
          maxWidth: "none",
        }}
        className={className}
        draggable={false}
        onError={() => setError(true)}
      />
    </div>
  );
}
