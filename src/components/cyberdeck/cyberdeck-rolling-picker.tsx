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
import { applyIosPickerSlideStyles, findClosestSnapIndex } from "@/lib/embla-ios-picker-loop";
import floatWheelStyles from "@/components/cyberdeck/float-wheel-picker.module.css";

const SNAP_ALIGN_THRESHOLD_PX = 0.5;
const SNAP_TOOLTIP_VISIBLE_MS = 1400;
const WHEEL_DELTA_TRIGGER_PX = 4;
const WHEEL_DELTA_PER_EXTRA_STEP_PX = 100;
const WHEEL_MAX_STEPS_PER_TICK = 3;
/** Scale wheel deltaY into Embla scroll distance (dragFree momentum). */
const WHEEL_MOMENTUM_GAIN = 0.52;
const WHEEL_MOMENTUM_FRICTION = 0.5;
const WHEEL_MOMENTUM_DURATION = 30;

export type CyberdeckRollingPickerItem = {
  value: string;
  label: string;
  slide: ReactNode;
  labelSlide?: ReactNode;
};

function snapOffsetPx(emblaApi: EmblaCarouselType, index: number): number {
  const { scrollSnaps, location } = emblaApi.internalEngine();
  return Math.abs((scrollSnaps[index] ?? 0) - location.get());
}

export type CyberdeckRollingPickerProps = {
  items: CyberdeckRollingPickerItem[];
  value: string;
  onChange: (value: string) => void;
  onUserSelect?: (value: string) => void;
  ariaLabel: string;
  viewportClassName?: string;
  showTextWhileScrolling?: boolean;
  alwaysShowLabel?: boolean;
  /** Same rotary always; neighbor opacity on while moving, off when snapped. */
  wheelExpandOnScroll?: boolean;
  /** See-through wheel band while spinning (glyph toolbar over status / composer). */
  wheelTransparent?: boolean;
  wheelNeighborCount?: number;
  slideHeightPx?: number;
  /** Minimum items to move per wheel tick (larger = faster for long lists). */
  wheelScrollStep?: number;
  /** Flick-style coast on wheel (uses Embla dragFree physics). Default on with `wheelExpandOnScroll`. */
  wheelMomentum?: boolean;
  /** While spinning show `label`; when snapped show `slide` (e.g. asky title → ascii). */
  wheelSettledShowsSlide?: boolean;
  tooltipSide?: "top" | "right" | "bottom" | "left";
  showTooltipOnSnap?: boolean;
};

function wheelStepsFromDelta(deltaY: number, baseStep: number): number {
  const extra = Math.floor(Math.abs(deltaY) / WHEEL_DELTA_PER_EXTRA_STEP_PX);
  return Math.min(WHEEL_MAX_STEPS_PER_TICK, baseStep + extra);
}

function normalizeIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return ((index % count) + count) % count;
}

function indexForValue(items: CyberdeckRollingPickerItem[], target: string): number {
  const idx = items.findIndex((item) => item.value.toLowerCase() === target.toLowerCase());
  return idx >= 0 ? idx : 0;
}

export function CyberdeckRollingPicker({
  items,
  value,
  onChange,
  onUserSelect,
  ariaLabel,
  viewportClassName = "h-7 w-7",
  showTextWhileScrolling = true,
  alwaysShowLabel = false,
  wheelExpandOnScroll = false,
  wheelTransparent = false,
  wheelNeighborCount = 3,
  slideHeightPx = 28,
  wheelScrollStep = 1,
  wheelMomentum,
  wheelSettledShowsSlide = false,
  tooltipSide = "top",
  showTooltipOnSnap = true,
}: CyberdeckRollingPickerProps) {
  const useWheelMomentum = wheelMomentum ?? wheelExpandOnScroll;
  const valueRef = useRef(value);
  valueRef.current = value;

  const itemsRef = useRef(items);
  itemsRef.current = items;

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const onUserSelectRef = useRef(onUserSelect);
  onUserSelectRef.current = onUserSelect;

  const isProgrammaticScrollRef = useRef(false);
  const itemsLengthRef = useRef(items.length);
  const neighborsVisibleRef = useRef(false);
  const [showLabels, setShowLabels] = useState(false);
  const [wheelSettled, setWheelSettled] = useState(true);
  const [centerIndex, setCenterIndex] = useState(0);

  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [tooltipLabel, setTooltipLabel] = useState("");
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userDraggedRef = useRef(false);

  const maxNeighborSteps = Math.max(0, Math.floor((wheelNeighborCount - 1) / 2));
  const expandedWheelHeightPx = slideHeightPx * wheelNeighborCount;

  const hideNeighborPreviews = useCallback((embla: EmblaCarouselType) => {
    neighborsVisibleRef.current = false;
    setWheelSettled(true);
    const center = findClosestSnapIndex(embla);
    setCenterIndex(center);
    embla.slideNodes().forEach((node, index) => {
      const inner = node.querySelector<HTMLElement>("[data-ios-picker-inner]");
      const target = inner ?? node;
      if (index === center) {
        target.style.opacity = "1";
        target.style.transform = "";
        target.style.pointerEvents = "";
      } else {
        target.style.opacity = "0";
        target.style.transform = "scale(1)";
        target.style.pointerEvents = "none";
      }
    });
  }, []);

  const showNeighborPreviews = useCallback(
    (embla: EmblaCarouselType, eventName?: string) => {
      neighborsVisibleRef.current = true;
      setWheelSettled(false);
      applyIosPickerSlideStyles(embla, eventName, {
        compact: true,
        rolodex: false,
        itemSizePx: slideHeightPx,
        maxNeighborSteps,
      });
      setCenterIndex(findClosestSnapIndex(embla));
    },
    [slideHeightPx, maxNeighborSteps],
  );

  const endProgrammaticScroll = useCallback((embla: EmblaCarouselType) => {
    isProgrammaticScrollRef.current = false;
  }, []);

  const wheelScrollStepRef = useRef(wheelScrollStep);
  wheelScrollStepRef.current = wheelScrollStep;
  const useWheelMomentumRef = useRef(useWheelMomentum);
  useWheelMomentumRef.current = useWheelMomentum;

  const applyWheelMomentum = useCallback((embla: EmblaCarouselType, deltaY: number) => {
    const engine = embla.internalEngine();
    engine.scrollBody.useFriction(WHEEL_MOMENTUM_FRICTION).useDuration(WHEEL_MOMENTUM_DURATION);
    engine.animation.start();
    engine.scrollTo.distance(deltaY * WHEEL_MOMENTUM_GAIN, false);
  }, []);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    axis: "y",
    loop: items.length > 1,
    align: "center",
    containScroll: false,
    dragFree: true,
    duration: wheelExpandOnScroll ? 14 : 20,
  });

  const commitSelection = useCallback((embla: EmblaCarouselType) => {
    const list = itemsRef.current;
    if (list.length === 0) return;
    const index = findClosestSnapIndex(embla);
    const entry = list[normalizeIndex(index, list.length)];
    if (!entry || entry.value === valueRef.current) return;
    onChangeRef.current(entry.value);
  }, []);

  const ensureSnappedToCenter = useCallback((embla: EmblaCarouselType): boolean => {
    const closest = findClosestSnapIndex(embla);
    if (snapOffsetPx(embla, closest) > SNAP_ALIGN_THRESHOLD_PX) {
      isProgrammaticScrollRef.current = true;
      embla.scrollTo(closest);
      return true;
    }
    return false;
  }, []);

  const showSnapTooltip = useCallback((embla: EmblaCarouselType) => {
    if (!showTooltipOnSnap || neighborsVisibleRef.current) return;
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
    if (!emblaApi || !wheelExpandOnScroll) return;
    hideNeighborPreviews(emblaApi);
  }, [emblaApi, wheelExpandOnScroll, hideNeighborPreviews, items.length]);

  useEffect(() => {
    if (!emblaApi) return;

    const onSelect = () => {
      if (isProgrammaticScrollRef.current) return;
      const engine = emblaApi.internalEngine();
      if (!engine.scrollBody.settled()) return;
      commitSelection(emblaApi);
    };

    const onPointerDown = () => {
      userDraggedRef.current = true;
      if (wheelExpandOnScroll) {
        showNeighborPreviews(emblaApi, "scroll");
      } else if (showTextWhileScrolling) {
        setShowLabels(true);
      }
    };

    const onWheel = (event: WheelEvent) => {
      if (itemsRef.current.length <= 1) return;
      if (Math.abs(event.deltaY) < WHEEL_DELTA_TRIGGER_PX) return;

      event.preventDefault();
      event.stopPropagation();
      userDraggedRef.current = true;

      if (wheelExpandOnScroll) {
        showNeighborPreviews(emblaApi, "scroll");
      }

      if (useWheelMomentumRef.current) {
        applyWheelMomentum(emblaApi, event.deltaY);
        return;
      }

      const direction = event.deltaY > 0 ? 1 : -1;
      const steps = wheelStepsFromDelta(event.deltaY, wheelScrollStepRef.current);
      const currentIndex = findClosestSnapIndex(emblaApi);
      const nextIndex = normalizeIndex(
        currentIndex + direction * steps,
        itemsRef.current.length,
      );
      isProgrammaticScrollRef.current = true;
      emblaApi.scrollTo(nextIndex);
    };

    const onSettle = () => {
      endProgrammaticScroll(emblaApi);

      const stillCentering = ensureSnappedToCenter(emblaApi);
      if (stillCentering) return;

      commitSelection(emblaApi);

      if (wheelExpandOnScroll) {
        hideNeighborPreviews(emblaApi);
      } else {
        setShowLabels(false);
      }

      const dragged = userDraggedRef.current;
      userDraggedRef.current = false;
      if (dragged) {
        const index = findClosestSnapIndex(emblaApi);
        const entry = itemsRef.current[normalizeIndex(index, itemsRef.current.length)];
        if (entry) {
          onUserSelectRef.current?.(entry.value);
        }
        if (!wheelExpandOnScroll) showSnapTooltip(emblaApi);
      }
    };

    const onScroll = () => {
      const engine = emblaApi.internalEngine();
      if (wheelExpandOnScroll && !engine.scrollBody.settled()) {
        showNeighborPreviews(emblaApi, "scroll");
      }
      if (engine.dragHandler.pointerDown()) return;
      if (!engine.scrollBody.settled()) return;
      if (useWheelMomentumRef.current) {
        showNeighborPreviews(emblaApi, "scroll");
      }
      ensureSnappedToCenter(emblaApi);
    };

    emblaApi.on("select", onSelect);
    emblaApi.on("pointerDown", onPointerDown);
    emblaApi.on("settle", onSettle);
    emblaApi.on("scroll", onScroll);
    emblaApi.rootNode().addEventListener("wheel", onWheel, { passive: false });

    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("pointerDown", onPointerDown);
      emblaApi.off("settle", onSettle);
      emblaApi.off("scroll", onScroll);
      emblaApi.rootNode().removeEventListener("wheel", onWheel);
    };
  }, [
    emblaApi,
    applyWheelMomentum,
    commitSelection,
    endProgrammaticScroll,
    ensureSnappedToCenter,
    hideNeighborPreviews,
    showNeighborPreviews,
    showSnapTooltip,
    showTextWhileScrolling,
    wheelExpandOnScroll,
  ]);

  useEffect(() => {
    if (!emblaApi) return;
    if (itemsLengthRef.current === items.length) return;
    itemsLengthRef.current = items.length;
    isProgrammaticScrollRef.current = true;
    emblaApi.reInit();
    emblaApi.scrollTo(indexForValue(itemsRef.current, valueRef.current), true);
    const onDone = () => {
      endProgrammaticScroll(emblaApi);
      if (wheelExpandOnScroll) hideNeighborPreviews(emblaApi);
      emblaApi.off("settle", onDone);
    };
    emblaApi.on("settle", onDone);
  }, [emblaApi, items.length, wheelExpandOnScroll, hideNeighborPreviews, endProgrammaticScroll]);

  useEffect(() => {
    if (!emblaApi || items.length === 0 || wheelExpandOnScroll) return;
    const index = indexForValue(items, value);
    if (emblaApi.selectedScrollSnap() === index) return;
    isProgrammaticScrollRef.current = true;
    emblaApi.scrollTo(index, true);
  }, [emblaApi, items.length, value, wheelExpandOnScroll]);

  useEffect(() => {
    if (!emblaApi || !wheelExpandOnScroll || items.length === 0) return;
    if (neighborsVisibleRef.current) return;
    const index = indexForValue(items, value);
    if (findClosestSnapIndex(emblaApi) === index) return;
    isProgrammaticScrollRef.current = true;
    emblaApi.scrollTo(index, true);
    const onDone = () => {
      endProgrammaticScroll(emblaApi);
      hideNeighborPreviews(emblaApi);
      emblaApi.off("settle", onDone);
    };
    emblaApi.on("settle", onDone);
  }, [emblaApi, items.length, value, wheelExpandOnScroll, hideNeighborPreviews, endProgrammaticScroll]);

  const activeItem = items.find((item) => item.value === value) ?? items[0];
  const tooltipText = tooltipLabel || activeItem?.label || "";
  const useLabelSlides = wheelSettledShowsSlide
    ? !wheelSettled
    : alwaysShowLabel || (showTextWhileScrolling && showLabels) || wheelExpandOnScroll;
  const shouldRenderTooltip = showTooltipOnSnap && Boolean(tooltipText);

  const renderLabelSlide = (item: CyberdeckRollingPickerItem, isActive: boolean) =>
    item.labelSlide ?? (
      <span
        className={cn(
          "block max-w-full truncate px-1 font-mono text-[8px] leading-none tracking-[0.04em]",
          isActive ? "text-emerald-200" : "text-[#b8c4be]",
          wheelTransparent &&
            "drop-shadow-[0_0_4px_rgba(0,0,0,1)] drop-shadow-[0_1px_2px_rgba(0,0,0,1)]",
        )}
      >
        {item.label}
      </span>
    );

  const renderSlideContent = (item: CyberdeckRollingPickerItem, isActive: boolean) => {
    if (wheelSettledShowsSlide && wheelExpandOnScroll && wheelSettled && isActive) {
      return item.slide ?? renderLabelSlide(item, true);
    }
    if (useLabelSlides) {
      return renderLabelSlide(item, isActive);
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

  const viewport = wheelExpandOnScroll ? (
    <div
      className={cn(
        floatWheelStyles.panel,
        floatWheelStyles.inline,
        floatWheelStyles.spinningHost,
        wheelTransparent && floatWheelStyles.panelTransparent,
        "min-w-[5.25rem] max-w-[10rem] shrink-0 touch-pan-y",
      )}
      style={{ ["--float-wheel-row-px" as string]: `${slideHeightPx}px` }}
      aria-label={ariaLabel}
    >
      <div
        className={cn(
          floatWheelStyles.wheelStage,
          floatWheelStyles.spinning,
          wheelTransparent && floatWheelStyles.wheelStageTransparent,
        )}
        style={{ height: expandedWheelHeightPx }}
      >
        <div ref={emblaRef} className={floatWheelStyles.viewport}>
          <div className="flex h-full flex-col">
            {items.map((item, index) => {
              const isCenter = index === centerIndex;
              return (
                <div
                  key={item.value}
                  className="flex min-h-0 shrink-0 items-center justify-center px-0.5"
                  style={{ flex: `0 0 ${slideHeightPx}px`, height: slideHeightPx }}
                >
                  <div
                    data-ios-picker-inner
                    className="flex w-full min-w-0 items-center justify-center will-change-[transform,opacity]"
                  >
                    {renderSlideContent(item, isCenter)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  ) : (
    <div
      ref={emblaRef}
      className={cn(
        "cursor-default overflow-hidden touch-pan-y transition-[width] duration-150 ease-out",
        viewportClassName,
        useLabelSlides && "w-auto",
        useLabelSlides && !alwaysShowLabel && "min-w-[5.25rem] max-w-[6.75rem]",
      )}
    >
      <div className="flex h-full flex-col">
        {items.map((item) => {
          const isActive = item.value === value;
          return (
            <div
              key={item.value}
              className="flex min-h-0 flex-[0_0_100%] shrink-0 items-center justify-center px-0.5"
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
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          "flex shrink-0 flex-col items-stretch",
          wheelExpandOnScroll && "overflow-visible",
          !wheelExpandOnScroll && "rounded border border-[#2d2d2d] bg-black",
        )}
        aria-label={wheelExpandOnScroll ? undefined : ariaLabel}
      >
        {shouldRenderTooltip ? (
          <Tooltip open={tooltipOpen} onOpenChange={setTooltipOpen}>
            <TooltipTrigger asChild>{viewport}</TooltipTrigger>
            <TooltipContent
              side={tooltipSide}
              align="center"
              sideOffset={6}
              className={CYBERDECK_PANE_TOOLTIP_CLASS}
            >
              {tooltipText}
            </TooltipContent>
          </Tooltip>
        ) : (
          viewport
        )}
      </div>
    </TooltipProvider>
  );
}
