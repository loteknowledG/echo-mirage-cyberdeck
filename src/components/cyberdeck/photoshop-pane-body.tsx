"use client";

import {
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MdTextFields } from "react-icons/md";
import { toast } from "sonner";
import { CyberdeckControl, CyberdeckPaneToolbarControl } from "@/components/cyberdeck/cyberdeck-control-button";
import { CyberdeckRollingPicker } from "@/components/cyberdeck/cyberdeck-rolling-picker";
import {
  CyberdeckControlTooltip,
  CyberdeckPaneTooltipProvider,
} from "@/components/cyberdeck/cyberdeck-pane-tooltip";
import { useDeckMode } from "@/lib/deck-mode";
import { paneToolbarMorphismZone } from "@/lib/cyberdeck/morphism-zones";
import { isAnimatedGifFile, applyTextOnGifViaApi } from "@/lib/photoshop-text-on-gif";
import {
  arrayBufferToBase64,
  readGifDragFile,
  setGifDragTransfer,
} from "@/lib/photoshop-gif-drag";
import {
  DEFAULT_PHOTOSHOP_FONT_FAMILY_ID,
  normalizePhotoshopFontFamilyId,
  PHOTOSHOP_FONT_FAMILIES,
  resolvePhotoshopCanvasFont,
  resolvePhotoshopFontFamily,
  type PhotoshopFontFamilyId,
} from "@/lib/photoshop-fonts";
import {
  DEFAULT_PHOTOSHOP_TEXT_COLOR,
  normalizePhotoshopTextColor,
  PHOTOSHOP_TEXT_COLORS,
  type PhotoshopTextColorId,
} from "@/lib/photoshop-text-colors";
import { cn } from "@/lib/utils";

const DEFAULT_FONT_SIZE_PX = 32;
const FONT_SIZE_OPTIONS = [12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72] as const;

const FONT_SIZE_SLIDE_CLASS =
  "flex w-full min-w-0 items-center justify-center overflow-hidden whitespace-nowrap px-1 font-mono text-[8px] leading-none tracking-[0.04em]";

const FONT_FAMILY_SLIDE_CLASS =
  "flex w-full min-w-0 items-center justify-center overflow-hidden whitespace-nowrap px-1 text-[8px] leading-none tracking-[0.02em]";

type TextPlacer = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  textColor: PhotoshopTextColorId;
  fontSizePx: number;
  fontFamilyId: PhotoshopFontFamilyId;
  text: string;
};

const DEFAULT_PLACER_WIDTH = 160;
const DEFAULT_PLACER_HEIGHT = 48;
const MIN_PLACER_WIDTH = 64;
const MIN_PLACER_HEIGHT = 32;
const PLACER_DRAG_HANDLE_PX = 12;
const PLACER_TEXT_INSET_X = 4;
const PLACER_TEXT_INSET_Y = 2;
const PREVIEW_PAD_X = 12;
const PREVIEW_PAD_TOP = 12;
const PREVIEW_PAD_BOTTOM = 12;
const PREVIEW_HINT_RESERVE = 40;

type ImageDisplayMetrics = {
  naturalWidth: number;
  naturalHeight: number;
  displayWidth: number;
  displayHeight: number;
  offsetX: number;
  offsetY: number;
};

function computeDisplayMetrics(
  containerWidth: number,
  containerHeight: number,
  naturalWidth: number,
  naturalHeight: number,
): ImageDisplayMetrics {
  const scale = Math.min(containerWidth / naturalWidth, containerHeight / naturalHeight);
  const displayWidth = naturalWidth * scale;
  const displayHeight = naturalHeight * scale;
  return {
    naturalWidth,
    naturalHeight,
    displayWidth,
    displayHeight,
    offsetX: (containerWidth - displayWidth) / 2,
    offsetY: (containerHeight - displayHeight) / 2,
  };
}

function measurePreviewGifMetrics(
  container: HTMLElement,
  img: HTMLImageElement,
  reserveHint: boolean,
): ImageDisplayMetrics | null {
  if (!img.naturalWidth || !img.naturalHeight) return null;

  const padBottom = PREVIEW_PAD_BOTTOM + (reserveHint ? PREVIEW_HINT_RESERVE : 0);
  const innerWidth = Math.max(0, container.clientWidth - PREVIEW_PAD_X * 2);
  const innerHeight = Math.max(0, container.clientHeight - PREVIEW_PAD_TOP - padBottom);
  if (innerWidth <= 0 || innerHeight <= 0) return null;

  const metrics = computeDisplayMetrics(innerWidth, innerHeight, img.naturalWidth, img.naturalHeight);
  return {
    ...metrics,
    offsetX: metrics.offsetX + PREVIEW_PAD_X,
    offsetY: metrics.offsetY + PREVIEW_PAD_TOP,
  };
}

function placerToGifPosition(placer: TextPlacer, metrics: ImageDisplayMetrics): { x: number; y: number } {
  const displayX = placer.x + PLACER_TEXT_INSET_X;
  const displayY = placer.y + PLACER_DRAG_HANDLE_PX + PLACER_TEXT_INSET_Y;
  const scaleX = metrics.naturalWidth / metrics.displayWidth;
  const scaleY = metrics.naturalHeight / metrics.displayHeight;
  const x = Math.round((displayX - metrics.offsetX) * scaleX);
  const y = Math.round((displayY - metrics.offsetY) * scaleY);
  return {
    x: Math.max(0, Math.min(metrics.naturalWidth, x)),
    y: Math.max(0, Math.min(metrics.naturalHeight, y)),
  };
}

type PhotoshopTextPlacerProps = {
  placer: TextPlacer;
  selected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<TextPlacer>) => void;
};

function PhotoshopTextPlacer({ placer, selected, onSelect, onChange }: PhotoshopTextPlacerProps) {
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const resizeRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originWidth: number;
    originHeight: number;
  } | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || editor.textContent === placer.text) return;
    editor.textContent = placer.text;
  }, [placer.text]);

  const handleDragPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      onSelect();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: placer.x,
        originY: placer.y,
      };
    },
    [onSelect, placer.x, placer.y],
  );

  const handleDragPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    onChange({
      x: Math.max(0, drag.originX + (event.clientX - drag.startX)),
      y: Math.max(0, drag.originY + (event.clientY - drag.startY)),
    });
  }, [onChange]);

  const handleDragPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const handleResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      onSelect();
      event.currentTarget.setPointerCapture(event.pointerId);
      resizeRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originWidth: placer.width,
        originHeight: placer.height,
      };
    },
    [onSelect, placer.height, placer.width],
  );

  const handleResizePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    onChange({
      width: Math.max(MIN_PLACER_WIDTH, resize.originWidth + (event.clientX - resize.startX)),
      height: Math.max(MIN_PLACER_HEIGHT, resize.originHeight + (event.clientY - resize.startY)),
    });
  }, [onChange]);

  const handleResizePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    resizeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  return (
    <div
      className={cn(
        "absolute flex min-h-0 min-w-0 flex-col overflow-hidden border border-dashed shadow-[0_0_0_1px_rgba(0,0,0,0.65)]",
        selected ? "border-emerald-400/80" : "border-[#888]/80",
      )}
      style={{
        left: placer.x,
        top: placer.y,
        width: placer.width,
        height: placer.height,
        backgroundColor: "transparent",
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
        onSelect();
      }}
    >
      <div
        role="presentation"
        aria-label="Move text placer"
        className="flex h-3 shrink-0 cursor-move items-center justify-center border-b border-dashed border-white/20 bg-transparent"
        onPointerDown={handleDragPointerDown}
        onPointerMove={handleDragPointerMove}
        onPointerUp={handleDragPointerUp}
        onPointerCancel={handleDragPointerUp}
      >
        <span className="h-0.5 w-4 rounded-full bg-current opacity-35" style={{ color: placer.textColor }} />
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        aria-label="Text placer"
        className="min-h-0 flex-1 overflow-auto px-1 py-0.5 leading-snug outline-none"
        style={{
          color: placer.textColor,
          fontSize: `${placer.fontSizePx}px`,
          fontFamily: resolvePhotoshopFontFamily(placer.fontFamilyId),
        }}
        onInput={(event) => onChange({ text: event.currentTarget.textContent ?? "" })}
      />

      <div
        role="presentation"
        aria-label="Resize text placer"
        className="absolute bottom-0 right-0 h-3 w-3 cursor-se-resize"
        onPointerDown={handleResizePointerDown}
        onPointerMove={handleResizePointerMove}
        onPointerUp={handleResizePointerUp}
        onPointerCancel={handleResizePointerUp}
      >
        <span
          className="absolute bottom-0.5 right-0.5 block h-1.5 w-1.5 border-r border-b"
          style={{ borderColor: placer.textColor }}
        />
      </div>
    </div>
  );
}

export function CyberdeckPhotoshopPaneBody() {
  const deckMode = useDeckMode();
  const previewRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragFileRef = useRef<File | null>(null);
  const stagedDragPathRef = useRef<string | null>(null);
  const gifMetricsRef = useRef<ImageDisplayMetrics | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [textPlacers, setTextPlacers] = useState<TextPlacer[]>([]);
  const [selectedPlacerId, setSelectedPlacerId] = useState<string | null>(null);
  const [defaultFontSizePx, setDefaultFontSizePx] = useState(DEFAULT_FONT_SIZE_PX);
  const [defaultFontFamilyId, setDefaultFontFamilyId] =
    useState<PhotoshopFontFamilyId>(DEFAULT_PHOTOSHOP_FONT_FAMILY_ID);
  const [defaultTextColor, setDefaultTextColor] =
    useState<PhotoshopTextColorId>(DEFAULT_PHOTOSHOP_TEXT_COLOR);

  const fontSizeItems = useMemo(
    () =>
      FONT_SIZE_OPTIONS.map((size) => {
        const label = `${size}px`;
        const slide = (
          <span className={FONT_SIZE_SLIDE_CLASS} title={label}>
            {size}
          </span>
        );
        return {
          value: String(size),
          label,
          slide,
          labelSlide: slide,
        };
      }),
    [],
  );

  const fontFamilyItems = useMemo(
    () =>
      PHOTOSHOP_FONT_FAMILIES.map((entry) => {
        const slide = (
          <span
            className={FONT_FAMILY_SLIDE_CLASS}
            style={{ fontFamily: entry.family }}
            title={entry.label}
          >
            {entry.label}
          </span>
        );
        return {
          value: entry.id,
          label: entry.label,
          slide,
          labelSlide: slide,
        };
      }),
    [],
  );

  const textColorItems = useMemo(
    () =>
      PHOTOSHOP_TEXT_COLORS.map((entry) => {
        const slide = (
          <span
            className="block h-3.5 w-3.5 rounded-sm border border-[#2d2d2d]"
            style={{ backgroundColor: entry.id }}
            title={entry.label}
          />
        );
        return {
          value: entry.id,
          label: entry.label,
          slide,
          labelSlide: slide,
        };
      }),
    [],
  );

  const activeFontSizePx =
    textPlacers.find((placer) => placer.id === selectedPlacerId)?.fontSizePx ?? defaultFontSizePx;
  const activeFontFamilyId =
    textPlacers.find((placer) => placer.id === selectedPlacerId)?.fontFamilyId ?? defaultFontFamilyId;
  const activeTextColor =
    textPlacers.find((placer) => placer.id === selectedPlacerId)?.textColor ?? defaultTextColor;

  const canApply = Boolean(
    sourceFile && textPlacers.some((placer) => placer.text.trim()) && !processing,
  );
  const canDragOutGif = Boolean(sourceFile && textPlacers.length === 0 && !processing);

  const refreshGifMetrics = useCallback(() => {
    const container = previewRef.current;
    const img = imgRef.current;
    if (!container || !img) {
      gifMetricsRef.current = null;
      return;
    }
    gifMetricsRef.current = measurePreviewGifMetrics(container, img, textPlacers.length === 0);
  }, [textPlacers.length]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    dragFileRef.current = null;
    stagedDragPathRef.current = null;
    if (!sourceFile) return;

    let cancelled = false;
    void (async () => {
      try {
        const dragFile = await readGifDragFile(sourceFile);
        if (cancelled) return;
        dragFileRef.current = dragFile;

        const bridge = window.echoMirageOpen;
        if (!bridge?.stageGifDrag) return;

        const buffer = await dragFile.arrayBuffer();
        if (cancelled) return;
        const staged = await bridge.stageGifDrag({
          base64: arrayBufferToBase64(buffer),
          fileName: dragFile.name,
        });
        if (cancelled) return;
        if (staged.ok && staged.filePath) {
          stagedDragPathRef.current = staged.filePath;
        }
      } catch {
        if (!cancelled) {
          dragFileRef.current = null;
          stagedDragPathRef.current = null;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sourceFile]);

  useEffect(() => {
    const container = previewRef.current;
    if (!container || !previewUrl) return;
    const observer = new ResizeObserver(() => refreshGifMetrics());
    observer.observe(container);
    return () => observer.disconnect();
  }, [previewUrl, refreshGifMetrics]);

  useEffect(() => {
    refreshGifMetrics();
  }, [previewUrl, refreshGifMetrics, textPlacers.length]);

  const loadGifFile = useCallback((file: File) => {
    if (!isAnimatedGifFile(file)) {
      toast.error("Drop a GIF file (.gif).");
      return;
    }

    setTextPlacers([]);
    setSelectedPlacerId(null);
    gifMetricsRef.current = null;
    setSourceFile(file);
    setPreviewUrl((prev) => {
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

  const addTextPlacer = useCallback(() => {
    const container = previewRef.current;
    const metrics = gifMetricsRef.current;
    const width = DEFAULT_PLACER_WIDTH;
    const height = DEFAULT_PLACER_HEIGHT;
    const areaX = metrics?.offsetX ?? 0;
    const areaY = metrics?.offsetY ?? 0;
    const areaW = metrics?.displayWidth ?? container?.clientWidth ?? width;
    const areaH = metrics?.displayHeight ?? container?.clientHeight ?? height;
    const x = Math.max(0, areaX + (areaW - width) / 2);
    const y = Math.max(0, areaY + (areaH - height) / 2);
    const id = crypto.randomUUID();

    setTextPlacers((prev) => [
      ...prev,
      {
        id,
        x,
        y,
        width,
        height,
        textColor: defaultTextColor,
        fontSizePx: defaultFontSizePx,
        fontFamilyId: defaultFontFamilyId,
        text: "",
      },
    ]);
    setSelectedPlacerId(id);
  }, [defaultFontFamilyId, defaultFontSizePx, defaultTextColor]);

  const updateTextPlacer = useCallback((id: string, patch: Partial<TextPlacer>) => {
    setTextPlacers((prev) => prev.map((placer) => (placer.id === id ? { ...placer, ...patch } : placer)));
  }, []);

  const handleFontSizeChange = useCallback(
    (next: string) => {
      const size = Number(next);
      if (!FONT_SIZE_OPTIONS.includes(size as (typeof FONT_SIZE_OPTIONS)[number])) return;
      setDefaultFontSizePx(size);
      if (selectedPlacerId) {
        updateTextPlacer(selectedPlacerId, { fontSizePx: size });
      }
    },
    [selectedPlacerId, updateTextPlacer],
  );

  const handleFontFamilyChange = useCallback(
    (next: string) => {
      const fontFamilyId = normalizePhotoshopFontFamilyId(next);
      setDefaultFontFamilyId(fontFamilyId);
      if (selectedPlacerId) {
        updateTextPlacer(selectedPlacerId, { fontFamilyId });
      }
    },
    [selectedPlacerId, updateTextPlacer],
  );

  const handleTextColorChange = useCallback(
    (next: string) => {
      const textColor = normalizePhotoshopTextColor(next);
      setDefaultTextColor(textColor);
      if (selectedPlacerId) {
        updateTextPlacer(selectedPlacerId, { textColor });
      }
    },
    [selectedPlacerId, updateTextPlacer],
  );

  const handleApply = useCallback(async () => {
    if (!sourceFile) {
      toast.error("Drop a GIF first.");
      return;
    }

    const placersWithText = textPlacers.filter((placer) => placer.text.trim());
    if (placersWithText.length === 0) {
      toast.error("Add text to at least one placer.");
      return;
    }

    const container = previewRef.current;
    const img = imgRef.current;
    if (!container || !img?.naturalWidth || !img.naturalHeight) {
      toast.error("GIF preview is not ready.");
      return;
    }

    refreshGifMetrics();
    const metrics = gifMetricsRef.current ?? measurePreviewGifMetrics(container, img, false);
    if (!metrics) {
      toast.error("GIF preview is not ready.");
      return;
    }

    setProcessing(true);
    try {
      let currentFile = sourceFile;

      for (const placer of placersWithText) {
        const { x, y } = placerToGifPosition(placer, metrics);
        const result = await applyTextOnGifViaApi(currentFile, {
          text: placer.text.trim(),
          fontSize: `${placer.fontSizePx}px`,
          fontColor: placer.textColor,
          fontStyle: resolvePhotoshopCanvasFont(placer.fontFamilyId),
          positionX: x,
          positionY: y,
        });

        if (!result.ok) {
          toast.error(result.error);
          return;
        }

        const binary = atob(result.base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
        currentFile = new File([bytes], result.fileName, { type: result.mimeType });
      }

      setSourceFile(currentFile);
      setTextPlacers([]);
      setSelectedPlacerId(null);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(currentFile);
      });
      toast.success("Caption applied.");
    } finally {
      setProcessing(false);
    }
  }, [refreshGifMetrics, sourceFile, textPlacers]);

  const handleGifDragStart = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!sourceFile || textPlacers.length > 0) {
        event.preventDefault();
        return;
      }

      const bridge = window.echoMirageOpen;
      const stagedPath = stagedDragPathRef.current;
      if (bridge?.startFileDrag && stagedPath) {
        event.preventDefault();
        bridge.startFileDrag(stagedPath);
        return;
      }

      const dragFile = dragFileRef.current;
      if (!dragFile) {
        event.preventDefault();
        toast.error("GIF export is still preparing. Try again in a moment.");
        return;
      }

      setGifDragTransfer(event.dataTransfer, dragFile);

      const img = imgRef.current;
      if (img) {
        event.dataTransfer.setDragImage(img, img.clientWidth / 2, img.clientHeight / 2);
      }
    },
    [sourceFile, textPlacers.length],
  );

  return (
    <CyberdeckPaneTooltipProvider delayDuration={300} disableHoverableContent>
      <div className="flex h-full min-h-0 flex-1 flex-col bg-black">
        {previewUrl ? (
          <div
            data-morphism={paneToolbarMorphismZone(deckMode)}
            className="z-10 flex w-full shrink-0 flex-wrap items-center justify-end gap-1.5 border-b border-[#141414] bg-black px-3 py-2"
          >
            <CyberdeckControlTooltip label="Font">
              <div className="flex h-7 w-[4.5rem] shrink-0">
                <CyberdeckRollingPicker
                  items={fontFamilyItems}
                  value={activeFontFamilyId}
                  onChange={handleFontFamilyChange}
                  ariaLabel="Font family"
                  viewportClassName="h-7 min-w-0 w-full max-w-none overflow-hidden rounded border border-[#2d2d2d] bg-black [scrollbar-width:none]"
                  slideHeightPx={28}
                  wheelScrollStep={1}
                  alwaysShowLabel={false}
                  showTextWhileScrolling={false}
                  loop
                />
              </div>
            </CyberdeckControlTooltip>
            <CyberdeckControlTooltip label="Font size">
              <div className="flex h-7 w-7 shrink-0">
                <CyberdeckRollingPicker
                  items={fontSizeItems}
                  value={String(activeFontSizePx)}
                  onChange={handleFontSizeChange}
                  ariaLabel="Font size"
                  viewportClassName="h-7 w-7 min-w-7 max-w-7 overflow-hidden rounded border border-[#2d2d2d] bg-black [scrollbar-width:none]"
                  slideHeightPx={28}
                  wheelScrollStep={1}
                  alwaysShowLabel={false}
                  showTextWhileScrolling={false}
                  loop
                />
              </div>
            </CyberdeckControlTooltip>
            <CyberdeckControlTooltip label="Font color">
              <div className="flex h-7 w-7 shrink-0">
                <CyberdeckRollingPicker
                  items={textColorItems}
                  value={activeTextColor}
                  onChange={handleTextColorChange}
                  ariaLabel="Font color"
                  viewportClassName="h-7 w-7 min-w-7 max-w-7 overflow-hidden rounded border border-[#2d2d2d] bg-black [scrollbar-width:none]"
                  slideHeightPx={28}
                  wheelScrollStep={1}
                  alwaysShowLabel={false}
                  showTextWhileScrolling={false}
                  loop
                />
              </div>
            </CyberdeckControlTooltip>
            <CyberdeckControlTooltip label="text">
              <CyberdeckPaneToolbarControl
                control={{ size: "toolbar", signal: true }}
                onClick={addTextPlacer}
                aria-label="text"
              >
                <MdTextFields className="h-3.5 w-3.5" />
              </CyberdeckPaneToolbarControl>
            </CyberdeckControlTooltip>
            <CyberdeckControlTooltip label="Apply">
              <CyberdeckControl
                control={{ size: "compact", signal: true }}
                onClick={() => void handleApply()}
                disabled={!canApply}
                aria-label="Apply"
                className="min-w-[3.25rem] px-2 font-mono text-[9px] tracking-[0.08em]"
              >
                {processing ? "…" : "APPLY"}
              </CyberdeckControl>
            </CyberdeckControlTooltip>
          </div>
        ) : null}

        <div
          ref={previewRef}
          className={cn(
            "relative min-h-0 min-w-0 flex-1 overflow-hidden",
            isDragOver && "ring-2 ring-inset ring-emerald-500/40",
            !previewUrl && "flex items-center justify-center border border-dashed border-[#1c1c1c]",
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onPointerDown={() => setSelectedPlacerId(null)}
        >
          {previewUrl ? (
            <>
              <div
                className="absolute flex min-h-0 min-w-0 items-center justify-center"
                style={{
                  left: PREVIEW_PAD_X,
                  right: PREVIEW_PAD_X,
                  top: PREVIEW_PAD_TOP,
                  bottom: canDragOutGif
                    ? PREVIEW_PAD_BOTTOM + PREVIEW_HINT_RESERVE
                    : PREVIEW_PAD_BOTTOM,
                }}
              >
                <div
                  draggable={canDragOutGif}
                  onDragStart={handleGifDragStart}
                  className={cn(
                    "flex h-full w-full min-h-0 min-w-0 items-center justify-center",
                    canDragOutGif && "cursor-grab active:cursor-grabbing",
                  )}
                >
                  <img
                    ref={imgRef}
                    src={previewUrl}
                    alt="Dropped GIF"
                    draggable={false}
                    onLoad={refreshGifMetrics}
                    className="block max-h-full max-w-full object-contain select-none"
                  />
                </div>
              </div>
              {canDragOutGif ? (
                <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-center font-mono text-[8px] tracking-[0.12em] text-[#505050]">
                  <div>DRAG GIF OUT</div>
                  <div className="mt-1 text-[7px] tracking-[0.1em] text-[#404040]">
                    USE CHROME/EDGE FOR PHOTOS WEB
                  </div>
                </div>
              ) : null}
              {textPlacers.map((placer) => (
                <PhotoshopTextPlacer
                  key={placer.id}
                  placer={placer}
                  selected={selectedPlacerId === placer.id}
                  onSelect={() => setSelectedPlacerId(placer.id)}
                  onChange={(patch) => updateTextPlacer(placer.id, patch)}
                />
              ))}
            </>
          ) : (
            <div className="text-center font-mono text-[10px] tracking-[0.08em] text-[#6a6a6a]">
              DROP ANIMATED GIF HERE
            </div>
          )}
        </div>
      </div>
    </CyberdeckPaneTooltipProvider>
  );
}
