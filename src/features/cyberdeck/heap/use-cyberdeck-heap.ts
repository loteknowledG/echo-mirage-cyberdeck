"use client";

import { useCallback, useEffect, useState } from "react";
import { get, set } from "idb-keyval";
import { toast } from "sonner";
import { copyTextToClipboard } from "@/lib/grok-image-prompt";
import { useCyberdeckTabStore } from "@/lib/cyberdeck-tab-store";
import {
  HEAP_STORAGE_KEY,
  readEchoMirageClipboardText,
  type HeapEntry,
} from "@/features/cyberdeck/heap/cyberdeck-heap-types";

export type UseCyberdeckHeapOptions = {
  openOperatorFile: (
    filePath: string,
    loader: () => Promise<void>,
  ) => void | Promise<void>;
  setOperatorTextAsset: (asset: {
    kind: "text";
    name: string;
    mimeType: string;
    size: number;
    text: string;
  }) => void;
  setOperatorSurfaceMode: (mode: "workspace" | "browser") => void;
  setOperatorDocMode: (mode: "edit" | "view") => void;
  setNavRailContext: (context: "gateway" | "tabs") => void;
};

export function useCyberdeckHeap({
  openOperatorFile,
  setOperatorTextAsset,
  setOperatorSurfaceMode,
  setOperatorDocMode,
  setNavRailContext,
}: UseCyberdeckHeapOptions) {
  const [heapEntries, setHeapEntries] = useState<HeapEntry[]>([]);
  const [heapNameDraft, setHeapNameDraft] = useState("");
  const [heapTextDraft, setHeapTextDraft] = useState("");
  const [heapHydrated, setHeapHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const saved = (await get<HeapEntry[]>(HEAP_STORAGE_KEY)) || [];
        if (!mounted) return;
        setHeapEntries(Array.isArray(saved) ? saved : []);
      } catch {
        if (!mounted) return;
        setHeapEntries([]);
      } finally {
        if (mounted) setHeapHydrated(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!heapHydrated) return;
    void set(HEAP_STORAGE_KEY, heapEntries).catch(() => {
      toast.error("Heap save failed.");
    });
  }, [heapEntries, heapHydrated]);

  const saveHeapDraft = useCallback(
    async (sourceText?: string) => {
      const text = (sourceText ?? heapTextDraft).trim();
      if (!text) {
        toast.error("Heap entry is empty.");
        return;
      }

      const nextName = heapNameDraft.trim() || `entry-${heapEntries.length + 1}`;
      const entry: HeapEntry = {
        id: crypto.randomUUID(),
        name: nextName,
        text: sourceText ?? heapTextDraft,
        createdAt: Date.now(),
      };

      setHeapEntries((prev) => [entry, ...prev]);
      setHeapNameDraft("");
      setHeapTextDraft("");
      toast.success(`Saved "${nextName}" to Heap.`);
    },
    [heapEntries.length, heapNameDraft, heapTextDraft],
  );

  const pasteClipboardToHeap = useCallback(async () => {
    try {
      const clipboardText = await readEchoMirageClipboardText();

      if (!clipboardText.trim()) {
        toast.error("Clipboard has no text.");
        return;
      }

      setHeapTextDraft(clipboardText);
      await saveHeapDraft(clipboardText);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not paste clipboard text.");
    }
  }, [saveHeapDraft]);

  const copyHeapEntry = useCallback(async (entry: HeapEntry) => {
    try {
      await copyTextToClipboard(entry.text);
      toast.success(`Copied "${entry.name}" to clipboard.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not copy heap entry.");
    }
  }, []);

  const openHeapEntryInOperator = useCallback(
    (entry: HeapEntry) => {
      const filePath = `heap://${entry.id}`;
      void openOperatorFile(filePath, async () => {
        const text = entry.text || "";
        setOperatorTextAsset({
          kind: "text",
          name: entry.name,
          mimeType: "text/plain",
          size: new Blob([text]).size,
          text,
        });
        setOperatorSurfaceMode("workspace");
        setOperatorDocMode("edit");
        useCyberdeckTabStore.getState().setServer("m");
        setNavRailContext("gateway");
      });
    },
    [
      openOperatorFile,
      setOperatorDocMode,
      setOperatorSurfaceMode,
      setOperatorTextAsset,
      setNavRailContext,
    ],
  );

  const deleteHeapEntry = useCallback((id: string) => {
    setHeapEntries((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  return {
    heapEntries,
    heapNameDraft,
    heapTextDraft,
    setHeapNameDraft,
    setHeapTextDraft,
    saveHeapDraft,
    pasteClipboardToHeap,
    copyHeapEntry,
    openHeapEntryInOperator,
    deleteHeapEntry,
  };
}
