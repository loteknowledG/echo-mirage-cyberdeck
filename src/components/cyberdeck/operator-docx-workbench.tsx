"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  OperatorDocxEditor,
  type OperatorDocxEditorHandle,
} from "@/components/cyberdeck/operator-docx-editor";
import { toEchoMirageFileUrl } from "@/lib/operator-binary-preview";
import { cn } from "@/lib/utils";

const OperatorDocxViewer = dynamic(
  () =>
    import("@/components/cyberdeck/operator-docx-viewer").then((mod) => mod.OperatorDocxViewer),
  {
    ssr: false,
    loading: () => (
      <div className="border border-[#1c1c1c] bg-black px-3 py-2 font-mono text-[10px] text-[#8a8a8a]">
        Loading DOCX preview…
      </div>
    ),
  },
);

type OperatorDocxWorkbenchProps = {
  fileName: string;
  docxSrc?: string;
  localFilePath?: string;
  mode: "view" | "edit";
  className?: string;
  onConvertToMarkdown?: () => void | Promise<void>;
  onBindDocxSave?: (save: (() => Promise<void>) | null) => void;
  onBindDocxSaveAs?: (saveAs: (() => Promise<void>) | null) => void;
};

export function OperatorDocxWorkbench({
  fileName,
  docxSrc,
  localFilePath,
  mode,
  className,
  onConvertToMarkdown,
  onBindDocxSave,
  onBindDocxSaveAs,
}: OperatorDocxWorkbenchProps) {
  const editorRef = useRef<OperatorDocxEditorHandle>(null);
  const [saving, setSaving] = useState(false);

  const uri = useMemo(() => {
    if (docxSrc?.trim()) return docxSrc;
    if (localFilePath?.trim()) return toEchoMirageFileUrl(localFilePath);
    return null;
  }, [docxSrc, localFilePath]);

  const saveDocx = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      await editorRef.current?.saveToDisk();
    } finally {
      setSaving(false);
    }
  }, [saving]);

  const saveDocxAs = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      await editorRef.current?.saveAsToDisk();
    } finally {
      setSaving(false);
    }
  }, [saving]);

  useEffect(() => {
    if (mode !== "edit") {
      onBindDocxSave?.(null);
      onBindDocxSaveAs?.(null);
      return;
    }
    onBindDocxSave?.(saveDocx);
    onBindDocxSaveAs?.(saveDocxAs);
    return () => {
      onBindDocxSave?.(null);
      onBindDocxSaveAs?.(null);
    };
  }, [mode, onBindDocxSave, onBindDocxSaveAs, saveDocx, saveDocxAs]);

  if (!uri) {
    return (
      <div className="rounded-sm border border-dashed border-[#1c1c1c] bg-black p-4 font-mono text-[10px] leading-snug text-[#8a8a8a]">
        Could not resolve a DOCX preview URL for {fileName}.
      </div>
    );
  }

  const canSave = Boolean(localFilePath?.trim());

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}>
      <div className="flex shrink-0 items-center gap-2 border-b border-[#1c1c1c] px-2 py-1 font-mono text-[9px] tracking-[0.04em] text-[#8a8a8a]">
        <span>DOCX // {mode === "edit" ? "EDIT" : "VIEW"}</span>
        {mode === "edit" ? (
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => void saveDocx()}
              disabled={saving || !canSave}
              title={canSave ? "Save DOCX to disk" : "Open from folder to enable save"}
              className="rounded border border-emerald-500/50 px-2 py-0.5 text-[8px] tracking-[0.06em] text-emerald-200 transition hover:border-emerald-400 hover:bg-emerald-950/40 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? "SAVING…" : "SAVE DOCX"}
            </button>
            {onConvertToMarkdown ? (
              <button
                type="button"
                onClick={() => void onConvertToMarkdown()}
                className="rounded border border-[#2d2d2d] px-2 py-0.5 text-[8px] tracking-[0.06em] text-[#8a8a8a] transition hover:border-emerald-500/50 hover:text-emerald-200"
              >
                TO MARKDOWN
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden bg-black">
        {mode === "edit" ? (
          <OperatorDocxEditor
            ref={editorRef}
            uri={uri}
            fileName={fileName}
            localFilePath={localFilePath}
            className="h-full min-h-[50vh]"
          />
        ) : (
          <OperatorDocxViewer uri={uri} fileName={fileName} className="h-full min-h-[50vh]" />
        )}
      </div>
    </div>
  );
}
