"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  cdxIconAdd,
  cdxIconArrowNext,
  cdxIconArrowPrevious,
  cdxIconTrash,
} from "@wikimedia/codex-icons";
import { motion } from "motion/react";
import { CodexIcon } from "@/components/codex-icon";
import { useDeckMode } from "@/lib/deck-mode";
import { isElectronOperatorBridge } from "@/lib/operator-binary-preview";
import {
  realmorphismActionClass,
  realmorphismControlClass,
} from "@/lib/cyberdeck/realmorphism-control";
import { toast } from "sonner";

type OperatorPdfPreviewProps = {
  fileName: string;
  pdfSrc?: string;
  localFilePath?: string;
  mode?: "view" | "edit";
};

type PdfTextBox = {
  id: string;
  page: number;
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
  fontSize: number;
  color: string;
  cover: boolean;
  pageWidth: number;
  pageHeight: number;
  canvasWidth: number;
  canvasHeight: number;
};

type PdfPageMetrics = {
  pageWidth: number;
  pageHeight: number;
  canvasWidth: number;
  canvasHeight: number;
};

const TEXT_BOX_PADDING = 8;
const DEFAULT_TEXT_BOX_WIDTH = 240;
const DEFAULT_TEXT_BOX_HEIGHT = 72;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

async function loadPdfBytes(pdfSrc?: string): Promise<Uint8Array> {
  if (!pdfSrc) throw new Error("No PDF source is available.");
  const response = await fetch(pdfSrc);
  if (!response.ok) throw new Error("Could not read PDF bytes.");
  return new Uint8Array(await response.arrayBuffer());
}

function hexToRgb01(hex: string): { red: number; green: number; blue: number } {
  const normalized = hex.replace(/^#/, "").trim();
  const safe = /^[0-9a-f]{6}$/i.test(normalized) ? normalized : "000000";
  const value = Number.parseInt(safe, 16);
  return {
    red: ((value >> 16) & 255) / 255,
    green: ((value >> 8) & 255) / 255,
    blue: (value & 255) / 255,
  };
}

function wrapText(
  text: string,
  maxWidth: number,
  font: { widthOfTextAtSize(text: string, size: number): number },
  size: number,
): string[] {
  const lines: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const words = rawLine.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !line) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function PdfTextBoxOverlay({
  box,
  selected,
  boundsRef,
  onSelect,
  onChange,
  onDelete,
}: {
  box: PdfTextBox;
  selected: boolean;
  boundsRef: React.RefObject<HTMLDivElement>;
  onSelect: () => void;
  onChange: (next: PdfTextBox) => void;
  onDelete: () => void;
}) {
  const moveBox = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      onSelect();
      const startX = event.clientX;
      const startY = event.clientY;
      const startBox = box;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const bounds = boundsRef.current?.getBoundingClientRect();
        const maxLeft = bounds ? Math.max(0, bounds.width - startBox.width) : Number.POSITIVE_INFINITY;
        const maxTop = bounds ? Math.max(0, bounds.height - startBox.height) : Number.POSITIVE_INFINITY;
        onChange({
          ...startBox,
          left: Math.max(0, Math.min(maxLeft, startBox.left + moveEvent.clientX - startX)),
          top: Math.max(0, Math.min(maxTop, startBox.top + moveEvent.clientY - startY)),
        });
      };

      const stopMove = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", stopMove);
        window.removeEventListener("pointercancel", stopMove);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", stopMove);
      window.addEventListener("pointercancel", stopMove);
    },
    [boundsRef, box, onChange, onSelect],
  );

  const resizeBox = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      onSelect();
      const startX = event.clientX;
      const startY = event.clientY;
      const startBox = box;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const bounds = boundsRef.current?.getBoundingClientRect();
        const maxWidth = bounds ? Math.max(48, bounds.width - startBox.left) : 1200;
        const maxHeight = bounds ? Math.max(28, bounds.height - startBox.top) : 1200;
        onChange({
          ...startBox,
          width: Math.max(48, Math.min(maxWidth, startBox.width + moveEvent.clientX - startX)),
          height: Math.max(28, Math.min(maxHeight, startBox.height + moveEvent.clientY - startY)),
        });
      };

      const stopResize = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", stopResize);
        window.removeEventListener("pointercancel", stopResize);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", stopResize);
      window.addEventListener("pointercancel", stopResize);
    },
    [boundsRef, box, onChange, onSelect],
  );

  return (
    <motion.div
      onPointerDown={onSelect}
      style={{
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
      }}
      className={[
        "absolute z-30 rounded-sm border bg-white/85 shadow-[0_0_18px_rgba(16,185,129,0.3)]",
        selected ? "border-emerald-300 ring-2 ring-emerald-400/50" : "border-emerald-500/50",
      ].join(" ")}
    >
      <button
        type="button"
        onPointerDown={moveBox}
        className="absolute -top-6 left-0 z-20 h-5 w-20 cursor-move border border-emerald-500/50 bg-black/90 font-mono text-[9px] text-emerald-200"
        aria-label="Drag text box"
      >
        MOVE
      </button>
      <textarea
        value={box.text}
        onFocus={onSelect}
        onChange={(event) => onChange({ ...box, text: event.target.value })}
        className="absolute inset-1 resize-none border-0 bg-transparent p-1 font-mono leading-tight text-black outline-none"
        style={{ fontSize: `${box.fontSize}px` }}
        placeholder="Type..."
      />
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
        className="absolute -right-2 -top-6 z-30 h-5 w-5 border border-emerald-500/50 bg-black/90 font-mono text-[12px] text-emerald-200"
        aria-label="Delete text box"
      >
        x
      </button>
      <button
        type="button"
        onPointerDown={resizeBox}
        className="absolute bottom-0 right-0 z-30 h-4 w-4 translate-x-1/2 translate-y-1/2 cursor-nwse-resize border border-emerald-300 bg-black"
        aria-label="Resize text box"
      />
    </motion.div>
  );
}

export function OperatorPdfPreview({
  fileName,
  pdfSrc,
  localFilePath,
  mode = "view",
}: OperatorPdfPreviewProps) {
  const deckMode = useDeckMode();
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editedBytes, setEditedBytes] = useState<Uint8Array | null>(null);
  const [pageCount, setPageCount] = useState(1);
  const [activePage, setActivePage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [metrics, setMetrics] = useState<PdfPageMetrics>({
    pageWidth: 612,
    pageHeight: 792,
    canvasWidth: 612,
    canvasHeight: 792,
  });
  const [boxes, setBoxes] = useState<PdfTextBox[]>([]);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pageLayerRef = useRef<HTMLDivElement>(null);
  const renderHostRef = useRef<HTMLDivElement>(null);
  const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewSrc = editedBytes
    ? `data:application/pdf;base64,${bytesToBase64(editedBytes)}`
    : pdfSrc;
  const selectedBox = boxes.find((box) => box.id === selectedBoxId) ?? null;

  useEffect(() => {
    setLoadError(false);
    setEditedBytes(null);
    setBoxes([]);
    setSelectedBoxId(null);
    setPageCount(1);
    setActivePage(1);
    if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
  }, [pdfSrc]);

  useEffect(() => {
    if (!previewSrc || !canvasRef.current || !pageLayerRef.current) return;
    let canceled = false;
    let renderTask: { cancel(): void; promise: Promise<unknown> } | null = null;

    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        const bytes = await loadPdfBytes(previewSrc);
        const pdfDoc = await pdfjs.getDocument({ data: bytes }).promise;
        if (canceled) return;
        setPageCount(pdfDoc.numPages);
        const pageNumber = Math.max(1, Math.min(pdfDoc.numPages, activePage));
        if (pageNumber !== activePage) setActivePage(pageNumber);
        const page = await pdfDoc.getPage(pageNumber);
        if (canceled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const hostWidth = renderHostRef.current?.clientWidth ?? baseViewport.width;
        const fitScale = Math.max(0.25, Math.min(2.5, (hostWidth - 24) / baseViewport.width));
        const viewport = page.getViewport({ scale: fitScale * zoom });
        const canvas = canvasRef.current;
        const pageLayer = pageLayerRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context || !pageLayer) return;

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        pageLayer.style.width = `${Math.floor(viewport.width)}px`;
        pageLayer.style.height = `${Math.floor(viewport.height)}px`;
        setMetrics({
          pageWidth: baseViewport.width,
          pageHeight: baseViewport.height,
          canvasWidth: viewport.width,
          canvasHeight: viewport.height,
        });

        renderTask = page.render({
          canvas,
          canvasContext: context,
          intent: "display",
          viewport,
        });
        await renderTask.promise;
      } catch (error) {
        if (!canceled && (error instanceof Error ? error.name !== "RenderingCancelledException" : true)) {
          setLoadError(true);
        }
      }
    })();

    return () => {
      canceled = true;
      renderTask?.cancel();
    };
  }, [activePage, previewSrc, zoom]);

  const openInSystemViewer = useCallback(async () => {
    if (!localFilePath) return;
    const bridge = window.echoMirageOpen;
    if (!bridge?.openPath) return;
    const result = await bridge.openPath(localFilePath);
    if (!result.ok) setLoadError(true);
  }, [localFilePath]);

  const addTextBox = useCallback(() => {
    const id = `pdf-box-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const pageRect = pageLayerRef.current?.getBoundingClientRect();
    const hostRect = renderHostRef.current?.getBoundingClientRect();
    const existingPageBoxes = boxes.filter((box) => box.page === activePage).length;
    const fallbackOffset = 72 + existingPageBoxes * 14;
    const viewportCenterX =
      pageRect && hostRect ? hostRect.left + hostRect.width / 2 - pageRect.left : fallbackOffset;
    const viewportCenterY =
      pageRect && hostRect ? hostRect.top + hostRect.height / 2 - pageRect.top : fallbackOffset;
    const left = Math.max(
      0,
      Math.min(metrics.canvasWidth - DEFAULT_TEXT_BOX_WIDTH, viewportCenterX - DEFAULT_TEXT_BOX_WIDTH / 2),
    );
    const top = Math.max(
      0,
      Math.min(metrics.canvasHeight - DEFAULT_TEXT_BOX_HEIGHT, viewportCenterY - DEFAULT_TEXT_BOX_HEIGHT / 2),
    );
    const nextBox: PdfTextBox = {
      id,
      page: activePage,
      text: "",
      left,
      top,
      width: DEFAULT_TEXT_BOX_WIDTH,
      height: DEFAULT_TEXT_BOX_HEIGHT,
      fontSize: selectedBox?.fontSize ?? 12,
      color: selectedBox?.color ?? "#000000",
      cover: selectedBox?.cover ?? false,
      pageWidth: metrics.pageWidth,
      pageHeight: metrics.pageHeight,
      canvasWidth: metrics.canvasWidth,
      canvasHeight: metrics.canvasHeight,
    };
    setBoxes((current) => [...current, nextBox]);
    setSelectedBoxId(id);
  }, [
    activePage,
    boxes,
    metrics.canvasHeight,
    metrics.canvasWidth,
    metrics.pageHeight,
    metrics.pageWidth,
    selectedBox?.color,
    selectedBox?.cover,
    selectedBox?.fontSize,
  ]);

  const updateBox = useCallback((nextBox: PdfTextBox) => {
    setBoxes((current) => current.map((box) => (box.id === nextBox.id ? nextBox : box)));
  }, []);

  const updateActivePage = useCallback(
    (nextPage: number) => {
      setActivePage(Math.max(1, Math.min(pageCount, nextPage)));
      setSelectedBoxId(null);
    },
    [pageCount],
  );

  const deleteSelectedBox = useCallback(() => {
    if (!selectedBoxId) return;
    setBoxes((current) => current.filter((box) => box.id !== selectedBoxId));
    setSelectedBoxId(null);
  }, [selectedBoxId]);

  const applyTextBoxes = useCallback(async () => {
    const drawableBoxes = boxes.filter((box) => box.text.trim() || box.cover);
    if (drawableBoxes.length === 0) {
      toast.error("Add a text box before applying.");
      return;
    }

    setBusy(true);
    try {
      const [{ PDFDocument, StandardFonts, rgb }, sourceBytes] = await Promise.all([
        import("pdf-lib"),
        editedBytes ? Promise.resolve(editedBytes) : loadPdfBytes(pdfSrc),
      ]);
      const pdfDoc = await PDFDocument.load(sourceBytes);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

      for (const box of drawableBoxes) {
        const pageIndex = Math.max(0, Math.min(pdfDoc.getPageCount() - 1, box.page - 1));
        const page = pdfDoc.getPage(pageIndex);
        const pageWidth = page.getWidth();
        const pageHeight = page.getHeight();
        const scaleX = pageWidth / box.canvasWidth;
        const scaleY = pageHeight / box.canvasHeight;
        const x = box.left * scaleX;
        const width = box.width * scaleX;
        const height = (box.height / box.canvasHeight) * pageHeight;
        const y = pageHeight - ((box.top + box.height) / box.canvasHeight) * pageHeight;
        const color = hexToRgb01(box.color);
        const contentX = x + TEXT_BOX_PADDING * scaleX;
        const contentTop = (box.top + TEXT_BOX_PADDING) * scaleY;
        const contentWidth = Math.max(1, width - TEXT_BOX_PADDING * 2 * scaleX);
        const pdfFontSize = box.fontSize * scaleY;

        if (box.cover) {
          page.drawRectangle({ x, y, width, height, color: rgb(1, 1, 1) });
        }

        if (box.text.trim()) {
          const lines = wrapText(box.text, contentWidth, font, pdfFontSize);
          const lineHeight = pdfFontSize * 1.2;
          const startY = pageHeight - contentTop - pdfFontSize;
          for (let index = 0; index < lines.length; index += 1) {
            const lineY = startY - index * lineHeight;
            if (lineY < y) break;
            page.drawText(lines[index], {
              x: contentX,
              y: lineY,
              size: pdfFontSize,
              font,
              color: rgb(color.red, color.green, color.blue),
            });
          }
        }
      }

      const nextBytes = await pdfDoc.save({ useObjectStreams: false });
      setEditedBytes(nextBytes);
      setBoxes([]);
      setSelectedBoxId(null);
      toast.success("PDF text boxes applied.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not edit PDF.");
    } finally {
      setBusy(false);
    }
  }, [boxes, editedBytes, pdfSrc]);

  const saveEditedPdf = useCallback(
    async (target: "in-place" | "as") => {
      if (!editedBytes) return;
      const base64 = bytesToBase64(editedBytes);

      if (target === "in-place" && localFilePath && window.echoMirageOpen?.writeBinaryFile) {
        setBusy(true);
        try {
          const result = await window.echoMirageOpen.writeBinaryFile(localFilePath, base64);
          if (!result.ok) {
            toast.error(result.error || "Could not save PDF.");
            return;
          }
          toast.success("PDF saved.");
        } finally {
          setBusy(false);
        }
        return;
      }

      const saveBridge = window.echoMirageSave;
      if (!saveBridge?.showBinaryDialog) {
        toast.error("Binary save requires the Echo Mirage desktop app.");
        return;
      }

      setBusy(true);
      try {
        const result = await saveBridge.showBinaryDialog({
          base64,
          defaultRelativePath: `docs/cadre/${fileName || "operator.pdf"}`,
          ...(localFilePath ? { defaultPath: localFilePath } : {}),
        });
        if (result.error) {
          toast.error(result.error);
          return;
        }
        if (!result.canceled) toast.success("PDF saved.");
      } finally {
        setBusy(false);
      }
    },
    [editedBytes, fileName, localFilePath],
  );

  const visibleBoxes = boxes.filter((box) => box.page === activePage);

  return (
    <div className="rounded-sm border border-[#1c1c1c] bg-black/80 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="font-mono text-[9px] tracking-[0.08em] text-[#8a8a8a]">
          {mode === "edit" ? "PDF EDIT" : "PDF VIEW"}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={activePage <= 1}
            onClick={() => updateActivePage(activePage - 1)}
            aria-label="Previous page"
            className={realmorphismControlClass(deckMode, {
              size: "compact",
              legacyClassName:
                "inline-flex h-8 items-center justify-center rounded border border-[#2d2d2d] bg-black px-2 text-[#8a8a8a] transition hover:border-emerald-500/60 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-40",
            })}
          >
            <CodexIcon icon={cdxIconArrowPrevious} className="h-3.5 w-3.5" />
          </button>
          <label className="flex h-8 items-center gap-1 border border-[#2d2d2d] bg-black px-2 font-mono text-[9px] tracking-[0.04em] text-[#8a8a8a]">
            PAGE
            <input
              type="number"
              min={1}
              max={pageCount}
              value={activePage}
              onChange={(event) => updateActivePage(Number(event.target.value) || 1)}
              className="h-5 w-10 border border-[#2d2d2d] bg-black px-1 text-green-200 outline-none"
            />
            / {pageCount}
          </label>
          <button
            type="button"
            disabled={activePage >= pageCount}
            onClick={() => updateActivePage(activePage + 1)}
            aria-label="Next page"
            className={realmorphismControlClass(deckMode, {
              size: "compact",
              legacyClassName:
                "inline-flex h-8 items-center justify-center rounded border border-[#2d2d2d] bg-black px-2 text-[#8a8a8a] transition hover:border-emerald-500/60 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-40",
            })}
          >
            <CodexIcon icon={cdxIconArrowNext} className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => setZoom((current) => Math.max(0.5, current - 0.1))} className={realmorphismActionClass(deckMode, "neutral")}>
            -
          </button>
          <span className="font-mono text-[9px] text-[#8a8a8a]">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((current) => Math.min(2.5, current + 0.1))} className={realmorphismActionClass(deckMode, "neutral")}>
            +
          </button>
          {mode === "edit" ? (
            <>
              <button
                type="button"
                onClick={addTextBox}
                aria-label="Add text box"
                className={realmorphismControlClass(deckMode, {
                  size: "compact",
                  legacyClassName:
                    "inline-flex h-8 items-center justify-center gap-1 rounded border border-emerald-500/50 bg-black px-2 font-mono text-[9px] tracking-[0.06em] text-emerald-200 transition hover:border-emerald-300",
                })}
              >
                <CodexIcon icon={cdxIconAdd} className="h-3.5 w-3.5" />
                TEXT
              </button>
              <button
                type="button"
                disabled={!selectedBox}
                onClick={deleteSelectedBox}
                aria-label="Delete selected text box"
                className={realmorphismControlClass(deckMode, {
                  size: "compact",
                  legacyClassName:
                    "inline-flex h-8 items-center justify-center rounded border border-[#2d2d2d] bg-black px-2 text-[#8a8a8a] transition hover:border-rose-500/60 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-40",
                })}
              >
                <CodexIcon icon={cdxIconTrash} className="h-3.5 w-3.5" />
              </button>
              <button type="button" disabled={busy || boxes.length === 0} onClick={() => void applyTextBoxes()} className={realmorphismActionClass(deckMode, "accent")}>
                APPLY
              </button>
              {selectedBox ? (
                <>
                  <label className="flex h-8 items-center gap-1 border border-[#2d2d2d] bg-black px-2 font-mono text-[9px] tracking-[0.04em] text-[#8a8a8a]">
                    SIZE
                    <input
                      type="number"
                      min={6}
                      max={96}
                      value={selectedBox.fontSize}
                      onChange={(event) => updateBox({ ...selectedBox, fontSize: Number(event.target.value) || 12 })}
                      className="h-5 w-12 border border-[#2d2d2d] bg-black px-1 text-green-200 outline-none"
                    />
                  </label>
                  <label className="flex h-8 items-center gap-1 border border-[#2d2d2d] bg-black px-2 font-mono text-[9px] tracking-[0.04em] text-[#8a8a8a]">
                    <input type="checkbox" checked={selectedBox.cover} onChange={(event) => updateBox({ ...selectedBox, cover: event.target.checked })} className="h-3 w-3 accent-emerald-500" />
                    COVER
                  </label>
                  <input type="color" aria-label="Selected text color" value={selectedBox.color} onChange={(event) => updateBox({ ...selectedBox, color: event.target.value })} className="h-8 w-9 border border-[#2d2d2d] bg-black p-0.5" />
                </>
              ) : null}
            </>
          ) : null}
          {localFilePath && isElectronOperatorBridge() ? (
            <button type="button" onClick={() => void openInSystemViewer()} className={realmorphismActionClass(deckMode, "neutral")}>
              OPEN IN VIEWER
            </button>
          ) : null}
          {mode === "edit" && editedBytes ? (
            <button type="button" disabled={busy} onClick={() => void saveEditedPdf("as")} className={realmorphismActionClass(deckMode, "accent")}>
              SAVE PDF
            </button>
          ) : null}
        </div>
      </div>
      {!loadError ? (
        <div ref={renderHostRef} className="custom-scrollbar max-h-[70vh] overflow-auto rounded-sm border border-[#1c1c1c] bg-[#101010] p-3">
          <div
            ref={pageLayerRef}
            className="relative mx-auto bg-white shadow-[0_0_20px_rgba(255,255,255,0.12)]"
          >
            {mode === "edit"
              ? visibleBoxes.map((box) => (
                  <PdfTextBoxOverlay
                    key={box.id}
                    box={box}
                    selected={box.id === selectedBoxId}
                    boundsRef={pageLayerRef}
                    onSelect={() => setSelectedBoxId(box.id)}
                    onChange={updateBox}
                    onDelete={() => {
                      setBoxes((current) => current.filter((entry) => entry.id !== box.id));
                      if (selectedBoxId === box.id) setSelectedBoxId(null);
                    }}
                  />
                ))
              : null}
            <canvas
              ref={canvasRef}
              className="block [color-scheme:light] [filter:none]"
            />
          </div>
        </div>
      ) : (
        <div className="rounded-sm border border-dashed border-[#1c1c1c] bg-black p-4 font-mono text-[10px] leading-snug text-[#8a8a8a]">
          PDF preview could not render in-pane. Use Open in Viewer or Convert.
        </div>
      )}
    </div>
  );
}
