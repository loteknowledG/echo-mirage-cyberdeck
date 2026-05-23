'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { EmblaCarouselType } from "embla-carousel";
import useEmblaCarousel from "embla-carousel-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CYBERDECK_PANE_TOOLTIP_CLASS } from "@/components/cyberdeck/cyberdeck-pane-tooltip";

const SNAP_ALIGN_THRESHOLD_PX = 0.5;
const SNAP_TOOLTIP_VISIBLE_MS = 1400;

export type CyberdeckRollingPickerItem = {
  value: string;
  label: string;
  slide: ReactNode;
  /** Shown while dragging or scrolling; defaults to `label`. */
  labelSlide?: ReactNode;
};

function findClosestSnapIndex(emblaApi: EmblaCarouselType): number {
  const { scrollSnaps, location } = emblaApi.internalEngine();
  const current = location.get();
  let closestIndex = 0;
  let minDistance = Number.POSITIVE_INFINITY;

  scrollSnaps.forEach((snap, index) => {
    const distance = Math.abs(snap - current);
    if (distance < minDistance) {
      minDistance = distance;
      closestIndex = index;
    }
  });

  return closestIndex;
}

function snapOffsetPx(emblaApi: EmblaCarouselType, index: number): number {
  const { scrollSnaps, location } = emblaApi.internalEngine();
  return Math.abs((scrollSnaps[index] ?? 0) - location.get());
}

export type CyberdeckRollingPickerProps = {
  items: CyberdeckRollingPickerItem[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  /** Viewport around one slide (default: 7×7 icon cell). */
  viewportClassName?: string;
  /** Icon when settled; text (or `labelSlide`) while drag / wheel scroll. */
  showTextWhileScrolling?: boolean;
  tooltipSide?: "top" | "right" | "bottom" | "left";
  showTooltipOnSnap?: boolean;
};

function normalizeIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return ((index % count) + count) % count;
}

function indexForValue(items: CyberdeckRollingPickerItem[], target: string): number {
  const idx = items.findIndex((item) => item.value.toLowerCase() === target.toLowerCase());
  return idx >= 0 ? idx : 0;
}

/** Compact Y-axis Embla picker — one slide visible, looped, dragFree with snap-to-center. */
export function CyberdeckRollingPicker({
  items,
  value,
  onChange,
  ariaLabel,
  viewportClassName = "h-7 w-7",
  showTextWhileScrolling = true,
  tooltipSide = "right",
  showTooltipOnSnap = true,
}: CyberdeckRollingPickerProps) {
  const valueRef = useRef(value);
  valueRef.current = value;

  const itemsRef = useRef(items);
  itemsRef.current = items;

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const isProgrammaticScrollRef = useRef(false);
  const itemsLengthRef = useRef(items.length);

  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [tooltipLabel, setTooltipLabel] = useState("");
  const [showLabels, setShowLabels] = useState(false);
  const showLabelsRef = useRef(false);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userDraggedRef = useRef(false);

  const setScrollingLabels = useCallback((active: boolean) => {
    showLabelsRef.current = active;
    setShowLabels(active);
    if (active && tooltipTimerRef.current) {
      clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = null;
      setTooltipOpen(false);
    }
  }, []);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    axis: "y",
    loop: items.length > 1,
    align: "center",
    containScroll: false,
    dragFree: true,
    duration: 20,
  });

  const emitSelection = useCallback((index: number) => {
    if (isProgrammaticScrollRef.current) return;
    const list = itemsRef.current;
    const entry = list[normalizeIndex(index, list.length)];
    if (!entry || entry.value === valueRef.current) return;
    onChangeRef.current(entry.value);
  }, []);

  const ensureSnappedToCenter = useCallback((embla: EmblaCarouselType) => {
    const closest = findClosestSnapIndex(embla);
    if (snapOffsetPx(embla, closest) > SNAP_ALIGN_THRESHOLD_PX) {
      isProgrammaticScrollRef.current = true;
      embla.scrollTo(closest);
    }
  }, []);

  const showSnapTooltip = useCallback((embla: EmblaCarouselType) => {
    if (!showTooltipOnSnap || showLabelsRef.current) return;
    const closest = findClosestSnapIndex(embla);
    if (snapOffsetPx(embla, closest) > SNAP_ALIGN_THRESHOLD_PX) return;

    const list = itemsRef.current;
    const entry = list[normalizeIndex(closest, list.length)];
    if (!entry) return;

    setTooltipLabel(entry.label);
    setTooltipOpen(true);
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    tooltipTimerRef.current = setTimeout(() => {
      setTooltipOpen(false);
      tooltipTimerRef.current = null;
    }, SNAP_TOOLTIP_VISIBLE_MS);
  }, [showTooltipOnSnap]);

  useEffect(() => {
    return () => {
      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!emblaApi) return;

    const onSelect = () => {
      emitSelection(emblaApi.selectedScrollSnap());
    };

    const onPointerDown = () => {
      userDraggedRef.current = true;
      if (showTextWhileScrolling) setScrollingLabels(true);
    };

    const onSettle = () => {
      isProgrammaticScrollRef.current = false;
      ensureSnappedToCenter(emblaApi);
      if (showTextWhileScrolling) setScrollingLabels(false);
      if (!userDraggedRef.current) return;
      userDraggedRef.current = false;
      showSnapTooltip(emblaApi);
    };

    const onScroll = () => {
      const engine = emblaApi.internalEngine();
      if (showTextWhileScrolling && !isProgrammaticScrollRef.current && !engine.scrollBody.settled()) {
        setScrollingLabels(true);
      }
      if (engine.dragHandler.pointerDown()) return;
      if (!engine.scrollBody.settled()) return;
      ensureSnappedToCenter(emblaApi);
    };

    emblaApi.on("select", onSelect);
    emblaApi.on("pointerDown", onPointerDown);
    emblaApi.on("settle", onSettle);
    emblaApi.on("scroll", onScroll);

    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("pointerDown", onPointerDown);
      emblaApi.off("settle", onSettle);
      emblaApi.off("scroll", onScroll);
    };
  }, [emblaApi, emitSelection, ensureSnappedToCenter, setScrollingLabels, showSnapTooltip, showTextWhileScrolling]);

  useEffect(() => {
    if (!emblaApi) return;
    if (itemsLengthRef.current === items.length) return;
    itemsLengthRef.current = items.length;
    isProgrammaticScrollRef.current = true;
    emblaApi.reInit();
    emblaApi.scrollTo(indexForValue(itemsRef.current, valueRef.current), true);
  }, [emblaApi, items.length]);

  useEffect(() => {
    if (!emblaApi || items.length === 0) return;
    const index = indexForValue(items, value);
    if (emblaApi.selectedScrollSnap() === index) return;
    isProgrammaticScrollRef.current = true;
    emblaApi.scrollTo(index, true);
  }, [emblaApi, items.length, value]);

  const activeItem =
    items.find((item) => item.value === value) ?? items[0];
  const tooltipText = tooltipLabel || activeItem?.label || "";
  const useLabelSlides = showTextWhileScrolling && showLabels;

  const renderSlideContent = (item: CyberdeckRollingPickerItem, isActive: boolean) => {
    if (useLabelSlides) {
      return (
        item.labelSlide ?? (
          <span
            className={cn(
              "block max-w-full truncate px-1 font-mono text-[8px] leading-none tracking-[0.04em]",
              isActive ? "text-emerald-200" : "text-[#8a8a8a]",
            )}
          >
            {item.label}
          </span>
        )
      );
    }
    return item.slide;
  };

  if (items.length === 0) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded border border-[#2d2d2d] bg-black font-mono text-[8px] text-[#6a6a6a] ${viewportClassName}`}
      >
        …
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className="flex shrink-0 flex-col items-center rounded border border-[#2d2d2d] bg-black"
        aria-label={ariaLabel}
      >
        <Tooltip open={tooltipOpen} onOpenChange={setTooltipOpen}>
          <TooltipTrigger asChild>
            <div
              ref={emblaRef}
              className={cn(
                "cursor-default overflow-hidden touch-pan-y transition-[width] duration-150 ease-out",
                viewportClassName,
                useLabelSlides && "w-auto min-w-[5.25rem] max-w-[6.75rem]",
              )}
            >
              <div className="flex h-full flex-col">
                {items.map((item) => {
                  const isActive = item.value === value;
                  return (
                    <div
                      key={item.value}
                      className="flex min-h-0 flex-[0_0_100%] items-center justify-center px-0.5"
                    >
                      <div
                        className={
                          useLabelSlides
                            ? "flex w-full min-w-0 items-center justify-center"
                            : isActive
                              ? "text-emerald-200"
                              : "text-[#8a8a8a]"
                        }
                      >
                        {renderSlideContent(item, isActive)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent
            side={tooltipSide}
            align="end"
            sideOffset={6}
            className={CYBERDECK_PANE_TOOLTIP_CLASS}
          >
            {tooltipText}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
