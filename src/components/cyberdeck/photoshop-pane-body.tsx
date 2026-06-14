"use client";

import {
  type ChangeEvent,
  type DragEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { CyberdeckControl } from "@/components/cyberdeck/cyberdeck-control-button";
import {
  CyberdeckPaneHeader,
  CyberdeckPaneHeaderSubtitle,
  CyberdeckPaneHeaderTitle,
} from "@/components/cyberdeck/pane-header";
import {
  applyTextOnGifViaApi,
  isAnimatedGifFile,
  type PhotoshopTextAlignmentX,
  type PhotoshopTextAlignmentY,
} from "@/lib/photoshop-text-on-gif";
import { cn } from "@/lib/utils";

function base64ToObjectUrl(base64: string, mimeType: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

export function CyberdeckPhotoshopPaneBody() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourcePreviewUrl, setSourcePreviewUrl] = useState<string | null>(null);
  const [outputPreviewUrl, setOutputPreviewUrl] = useState<string | null>(null);
  const [outputFileName, setOutputFileName] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [fontSize, setFontSize] = useState("32px");
  const [fontColor, setFontColor] = useState("#ffffff");
  const [alignmentX, setAlignmentX] = useState<PhotoshopTextAlignmentX>("center");
  const [alignmentY, setAlignmentY] = useState<PhotoshopTextAlignmentY>("bottom");
  const [isDragOver, setIsDragOver] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    return () => {
      if (sourcePreviewUrl) URL.revokeObjectURL(sourcePreviewUrl);
    };
  }, [sourcePreviewUrl]);

  useEffect(() => {
    return () => {
      if (outputPreviewUrl) URL.revokeObjectURL(outputPreviewUrl);
    };
  }, [outputPreviewUrl]);

  const loadGifFile = useCallback((file: File) => {
    if (!isAnimatedGifFile(file)) {
      toast.error("Drop a GIF file (.gif).");
      return;
    }

    setSourceFile(file);
    setOutputFileName(null);
    setOutputPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setSourcePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }, []);

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragOver(false);

      const file = event.dataTransfer.files?.[0];
      if (file) loadGifFile(file);
    },
    [loadGifFile],
  );

  const handleFileInput = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (file) loadGifFile(file);
    },
    [loadGifFile],
  );

  const handleApplyText = useCallback(async () => {
    if (!sourceFile) {
      toast.error("Drop a GIF first.");
      return;
    }
    if (!text.trim()) {
      toast.error("Enter caption text.");
      return;
    }

    setProcessing(true);
    try {
      const result = await applyTextOnGifViaApi(sourceFile, {
        text,
        fontSize,
        fontColor,
        alignmentX,
        alignmentY,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setOutputPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return base64ToObjectUrl(result.base64, result.mimeType);
      });
      setOutputFileName(result.fileName);
      toast.success("Caption applied.");
    } finally {
      setProcessing(false);
    }
  }, [alignmentX, alignmentY, fontColor, fontSize, sourceFile, text]);

  const handleDownload = useCallback(() => {
    if (!outputPreviewUrl || !outputFileName) return;
    const anchor = document.createElement("a");
    anchor.href = outputPreviewUrl;
    anchor.download = outputFileName;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }, [outputFileName, outputPreviewUrl]);

  const handleClear = useCallback(() => {
    setSourceFile(null);
    setText("");
    setOutputFileName(null);
    setSourcePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setOutputPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  return (
    <div className="custom-scrollbar flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-black p-3">
      <div className="flex min-h-0 flex-1 flex-col rounded-sm border border-[#141414] bg-black">
        <CyberdeckPaneHeader
          left={
            <div className="flex flex-col">
              <CyberdeckPaneHeaderTitle style={{ textShadow: "0 0 6px rgba(57,255,136,0.12)" }}>
                PHOTOSHOP
              </CyberdeckPaneHeaderTitle>
              <CyberdeckPaneHeaderSubtitle>GIF LAB // CAPTION // EXPORT</CyberdeckPaneHeaderSubtitle>
            </div>
          }
        />

        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col gap-3 p-3",
            isDragOver && "ring-2 ring-emerald-500/40 ring-inset",
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/gif,.gif"
            className="sr-only"
            onChange={handleFileInput}
          />

          <div className="flex flex-wrap items-center gap-2">
            <CyberdeckControl control={{ size: "wide" }} onClick={() => fileInputRef.current?.click()}>
              OPEN GIF
            </CyberdeckControl>
            <CyberdeckControl
              control={{ size: "wide" }}
              onClick={() => void handleApplyText()}
              disabled={!sourceFile || processing || !text.trim()}
            >
              {processing ? "RENDERING…" : "APPLY TEXT"}
            </CyberdeckControl>
            <CyberdeckControl
              control={{ size: "wide" }}
              onClick={handleDownload}
              disabled={!outputPreviewUrl}
            >
              DOWNLOAD
            </CyberdeckControl>
            <CyberdeckControl control={{ size: "wide" }} onClick={handleClear} disabled={!sourceFile}>
              CLEAR
            </CyberdeckControl>
          </div>

          <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div
              className={cn(
                "flex min-h-[280px] flex-col items-center justify-center rounded border border-[#1c1c1c] bg-[#050505] p-4",
                !sourcePreviewUrl && "border-dashed",
              )}
            >
              {sourcePreviewUrl ? (
                <img
                  src={sourcePreviewUrl}
                  alt={sourceFile?.name ?? "GIF preview"}
                  className="max-h-[50vh] max-w-full object-contain"
                />
              ) : (
                <div className="text-center font-mono text-[10px] tracking-[0.08em] text-[#6a6a6a]">
                  <div>DROP ANIMATED GIF HERE</div>
                  <div className="mt-2 text-[8px] tracking-[0.12em] text-[#505050]">
                    OR CLICK OPEN GIF
                  </div>
                </div>
              )}
              {sourceFile ? (
                <div className="mt-2 truncate font-mono text-[8px] text-[#666]">{sourceFile.name}</div>
              ) : null}
            </div>

            <aside className="flex flex-col gap-3 font-mono text-[10px] text-[#888]">
              <label className="flex flex-col gap-1">
                <span className="text-[8px] tracking-[0.12em] text-[#555]">CAPTION</span>
                <textarea
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  rows={4}
                  placeholder="Text burned into every frame…"
                  className="resize-y rounded border border-[#222] bg-black px-2 py-1.5 text-[10px] text-[#ddd] outline-none focus:border-emerald-500/50"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[8px] tracking-[0.12em] text-[#555]">FONT SIZE</span>
                <input
                  value={fontSize}
                  onChange={(event) => setFontSize(event.target.value)}
                  className="rounded border border-[#222] bg-black px-2 py-1 text-[10px] text-[#ddd] outline-none focus:border-emerald-500/50"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[8px] tracking-[0.12em] text-[#555]">FONT COLOR</span>
                <input
                  type="color"
                  value={fontColor}
                  onChange={(event) => setFontColor(event.target.value)}
                  className="h-8 w-full cursor-pointer rounded border border-[#222] bg-black"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[8px] tracking-[0.12em] text-[#555]">HORIZONTAL</span>
                <select
                  value={alignmentX}
                  onChange={(event) => setAlignmentX(event.target.value as PhotoshopTextAlignmentX)}
                  className="rounded border border-[#222] bg-black px-2 py-1 text-[10px] text-[#ddd] outline-none focus:border-emerald-500/50"
                >
                  <option value="left">left</option>
                  <option value="center">center</option>
                  <option value="right">right</option>
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[8px] tracking-[0.12em] text-[#555]">VERTICAL</span>
                <select
                  value={alignmentY}
                  onChange={(event) => setAlignmentY(event.target.value as PhotoshopTextAlignmentY)}
                  className="rounded border border-[#222] bg-black px-2 py-1 text-[10px] text-[#ddd] outline-none focus:border-emerald-500/50"
                >
                  <option value="top">top</option>
                  <option value="middle">middle</option>
                  <option value="bottom">bottom</option>
                </select>
              </label>
            </aside>
          </div>

          {outputPreviewUrl ? (
            <div className="rounded border border-[#1c1c1c] bg-[#050505] p-3">
              <div className="mb-2 font-mono text-[8px] tracking-[0.12em] text-[#555]">OUTPUT PREVIEW</div>
              <img
                src={outputPreviewUrl}
                alt={outputFileName ?? "Output GIF"}
                className="max-h-[40vh] max-w-full object-contain"
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
