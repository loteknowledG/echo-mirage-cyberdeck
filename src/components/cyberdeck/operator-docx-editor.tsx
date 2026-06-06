"use client";

import "@eigenpal/docx-editor-react/styles.css";
import type { DocxEditorRef } from "@eigenpal/docx-editor-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { fetchOperatorDocxBlob } from "@/lib/operator-binary-preview";
import { sanitizeDocxBlobForPreview } from "@/lib/operator-docx-sanitize";

export type OperatorDocxEditorHandle = {
  save: () => Promise<ArrayBuffer | null>;
  saveToDisk: () => Promise<boolean>;
  saveAsToDisk: () => Promise<boolean>;
};

type OperatorDocxEditorProps = {
  uri: string;
  fileName: string;
  localFilePath?: string;
  className?: string;
};

/** In-pane WYSIWYG DOCX editor (@eigenpal/docx-editor-react). */
export const OperatorDocxEditor = forwardRef<OperatorDocxEditorHandle, OperatorDocxEditorProps>(
  function OperatorDocxEditor({ uri, fileName, localFilePath, className }, ref) {
    const editorRef = useRef<DocxEditorRef>(null);
    const [DocxEditor, setDocxEditor] = useState<
      typeof import("@eigenpal/docx-editor-react").DocxEditor | null
    >(null);
    const [buffer, setBuffer] = useState<ArrayBuffer | undefined>(undefined);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const persistSave = useCallback(
      async (saved: ArrayBuffer) => {
        const path = localFilePath?.trim();
        if (!path) {
          toast.error("Save requires opening this file from a folder path.");
          return false;
        }
        const bridge = window.echoMirageOpen;
        if (!bridge?.writeBinaryFile) {
          toast.error("Saving DOCX requires the Echo Mirage desktop app.");
          return false;
        }
        const bytes = new Uint8Array(saved);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const result = await bridge.writeBinaryFile(path, btoa(binary));
        if (!result.ok) {
          toast.error(result.error || "Could not save DOCX.");
          return false;
        }
        toast.success(`Saved ${fileName}`);
        return true;
      },
      [fileName, localFilePath],
    );

    const saveToDisk = useCallback(async () => {
      if (saving) return false;
      setSaving(true);
      try {
        const saved = await editorRef.current?.save();
        if (!saved) {
          toast.error("Could not serialize DOCX.");
          return false;
        }
        return await persistSave(saved);
      } finally {
        setSaving(false);
      }
    }, [persistSave, saving]);

    const saveAsToDisk = useCallback(async () => {
      if (saving) return false;
      setSaving(true);
      try {
        const saved = await editorRef.current?.save();
        if (!saved) {
          toast.error("Could not serialize DOCX.");
          return false;
        }
        const saveBridge = window.echoMirageSave;
        if (!saveBridge?.showBinaryDialog) {
          toast.error("Save as requires the Echo Mirage desktop app.");
          return false;
        }
        const bytes = new Uint8Array(saved);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const result = await saveBridge.showBinaryDialog({
          base64: btoa(binary),
          defaultRelativePath: `docs/cadre/${fileName || "operator.docx"}`,
          ...(localFilePath?.trim() ? { defaultPath: localFilePath.trim() } : {}),
        });
        if (result.error) {
          toast.error(result.error);
          return false;
        }
        if (!result.canceled) {
          toast.success(`Saved ${fileName}`);
          return true;
        }
        return false;
      } finally {
        setSaving(false);
      }
    }, [fileName, localFilePath, saving]);

    useImperativeHandle(
      ref,
      () => ({
        save: async () => editorRef.current?.save() ?? null,
        saveToDisk,
        saveAsToDisk,
      }),
      [saveAsToDisk, saveToDisk],
    );

    useEffect(() => {
      let cancelled = false;
      void import("@eigenpal/docx-editor-react").then((mod) => {
        if (!cancelled) {
          setDocxEditor(() => mod.DocxEditor);
        }
      });
      return () => {
        cancelled = true;
      };
    }, []);

    useEffect(() => {
      let cancelled = false;
      setLoading(true);
      setError(null);
      setBuffer(undefined);

      void (async () => {
        try {
          const blob = await fetchOperatorDocxBlob(uri);
          if (cancelled) return;
          const safeBlob = await sanitizeDocxBlobForPreview(blob);
          if (cancelled) return;
          setBuffer(await safeBlob.arrayBuffer());
        } catch (err) {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : "Could not load DOCX for editing.");
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [uri, fileName]);

    const handleEditorSave = useCallback(
      async (saved: ArrayBuffer) => {
        await persistSave(saved);
      },
      [persistSave],
    );

    if (error) {
      return (
        <div className="rounded-sm border border-red-900/60 bg-black p-4 font-mono text-[10px] leading-snug text-red-200">
          <div className="mb-2 text-red-300">DOCX EDIT // FAILED</div>
          <div className="text-[#9a9a9a]">{error}</div>
        </div>
      );
    }

    if (loading || !DocxEditor || buffer === undefined) {
      return (
        <div className="border border-[#1c1c1c] bg-black px-3 py-2 font-mono text-[10px] text-[#8a8a8a]">
          Loading DOCX editor…
        </div>
      );
    }

    return (
      <div
        className={`operator-docx-editor-host flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f3f3f3] ${className ?? ""}`.trim()}
        data-testid="operator-docx-editor"
      >
        <DocxEditor
          ref={editorRef}
          documentBuffer={buffer}
          mode="editing"
          showToolbar
          showZoomControl
          showRuler
          onSave={handleEditorSave}
          toolbarExtra={
            <button
              type="button"
              onClick={() => void saveToDisk()}
              disabled={saving || !localFilePath?.trim()}
              title={localFilePath?.trim() ? "Save DOCX to disk" : "Open from folder to enable save"}
              className="rounded border border-[#2d2d2d] bg-white px-2 py-0.5 font-mono text-[10px] tracking-[0.04em] text-[#333] transition hover:border-emerald-600 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? "SAVING…" : "SAVE"}
            </button>
          }
          className="min-h-0 flex-1"
          style={{ minHeight: "50vh", height: "100%" }}
        />
      </div>
    );
  },
);
