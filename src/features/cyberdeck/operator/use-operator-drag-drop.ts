"use client";

import type { DragEvent as ReactDragEvent } from "react";
import { useCallback, useState } from "react";
import type { OperatorIngestHints } from "@/lib/operator-file-surface";
import type { CyberdeckServerId } from "@/lib/cyberdeck-tab-store";

export type UseOperatorDragDropOptions = {
  getActiveServerId: () => CyberdeckServerId;
  openOperatorFile: (
    filePath: string,
    load: () => Promise<void>,
    fromHistory?: boolean,
  ) => Promise<void>;
  loadOperatorAssetFromFile: (file: File, hints?: OperatorIngestHints) => Promise<void>;
};

export function useOperatorDragDrop({
  getActiveServerId,
  openOperatorFile,
  loadOperatorAssetFromFile,
}: UseOperatorDragDropOptions) {
  const [isOperatorDragOver, setIsOperatorDragOver] = useState(false);

  const handleOperatorDragOver = useCallback(
    (e: ReactDragEvent<HTMLDivElement>) => {
      if (getActiveServerId() !== "m") return;
      e.preventDefault();
      setIsOperatorDragOver(true);
    },
    [getActiveServerId],
  );

  const handleOperatorDragLeave = useCallback((e: ReactDragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsOperatorDragOver(false);
  }, []);

  const handleOperatorDrop = useCallback(
    async (e: ReactDragEvent<HTMLDivElement>) => {
      const activeServer = getActiveServerId();
      if (activeServer !== "m") return;

      e.preventDefault();
      setIsOperatorDragOver(false);

      const file = e.dataTransfer.files?.[0];
      if (file) {
        const dropPath = `drop://${file.name}#${file.lastModified}`;
        await openOperatorFile(dropPath, () => loadOperatorAssetFromFile(file));
        return;
      }

      const uriList = e.dataTransfer.getData("text/uri-list");
      if (uriList) {
        const uris = uriList.split("\n").filter((u) => u.trim() && !u.startsWith("#"));
        if (uris.length > 0) {
          const uri = uris[0];
          if (uri.startsWith("file://")) {
            const filePath = uri.startsWith("file:///")
              ? uri.slice(8)
              : uri.startsWith("file://localhost/")
                ? uri.slice("file://localhost".length)
                : uri.slice(7);
            try {
              const response = await fetch(uri);
              if (response.ok) {
                const blob = await response.blob();
                const fileName = filePath.split("/").pop() || "dropped-image";
                const droppedFile = new File([blob], fileName, { type: blob.type || "image/png" });
                await loadOperatorAssetFromFile(droppedFile);
                return;
              }
            } catch {
              // fallback: try reading as text path
            }
          }
        }
      }

      const textPath = e.dataTransfer.getData("text/plain");
      if (textPath && textPath.startsWith("/")) {
        try {
          const response = await fetch(`file://${textPath}`);
          if (response.ok) {
            const blob = await response.blob();
            const fileName = textPath.split("/").pop() || "dropped-image";
            const droppedFile = new File([blob], fileName, { type: blob.type || "image/png" });
            await loadOperatorAssetFromFile(droppedFile);
          }
        } catch {
          // ignore
        }
      }
    },
    [getActiveServerId, loadOperatorAssetFromFile, openOperatorFile],
  );

  return {
    isOperatorDragOver,
    handleOperatorDragOver,
    handleOperatorDragLeave,
    handleOperatorDrop,
  };
}
