'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { EmblaCarouselType } from "embla-carousel";
import useEmblaCarousel from "embla-carousel-react";
import { cn } from "@/lib/utils";
import {
  applyIosPickerSlideStyles,
  applyPinnedShowroomSlideStyles,
  findClosestSnapIndex,
} from "@/lib/embla-ios-picker-loop";
import floatWheelStyles from "@/components/cyberdeck/float-wheel-picker.module.css";

const SNAP_ALIGN_THRESHOLD_PX = 0.5;
const WHEEL_DELTA_TRIGGER_PX = 4;
const WHEEL_DELTA_PER_EXTRA_STEP_PX = 100;
const WHEEL_MAX_STEPS_PER_TICK = 3;
/** Expand wheels (glyph toolbar, showroom) — overshoot + snap-back settle. */
const EXPAND_WHEEL_MOMENTUM_GAIN = 1.12;
const EXPAND_WHEEL_MOMENTUM_FRICTION = 0.93;
const EXPAND_WHEEL_MOMENTUM_DURATION = 62;
const EXPAND_DRAG_FLICK_VELOCITY_SCALE = 16;
/** Compact icon rollers (operator doc type, engine, export). */
const COMPACT_WHEEL_MOMENTUM_GAIN = 0.98;
const COMPACT_WHEEL_MOMENTUM_FRICTION = 0.9;
const COMPACT_WHEEL_MOMENTUM_DURATION = 54;
const COMPACT_DRAG_FLICK_VELOCITY_SCALE = 11;

export type CyberdeckRollingPickerItem = {
  value: string;
  label: string;
  slide?: ReactNode;
  /** When set, receives whether this row is the wheel center (for active/inactive styling). */
  renderSlide?: (active: boolean) => ReactNode;
  labelSlide?: ReactNode;
  renderLabelSlide?: (active: boolean) => ReactNode;
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
  /** Showroom: full-height wheel with neighbors always visible (not a one-row toolbar sliver). */
  wheelPinnedOpen?: boolean;
  /** See-through wheel band while spinning (glyph toolbar over status / composer). */
  wheelTransparent?: boolean;
  wheelNeighborCount?: number;
  slideHeightPx?: number;
  /** Minimum items to move per wheel tick (larger = faster for long lists). */
  wheelScrollStep?: number;
  /** Flick-style coast on wheel + drag release (default on). */
  wheelMomentum?: boolean;
  wheelMomentumGain?: number;
  wheelMomentumFriction?: number;
  wheelMomentumDuration?: number;
  /** While spinning show `label`; when snapped show `slide` (e.g. asky title → ascii). */
  wheelSettledShowsSlide?: boolean;
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
  wheelPinnedOpen = false,
  wheelTransparent = false,
  wheelNeighborCount = 3,
  slideHeightPx = 28,
  wheelScrollStep = 1,
  wheelMomentum,
  wheelMomentumGain,
  wheelMomentumFriction,
  wheelMomentumDuration,
  wheelSettledShowsSlide = false,
}: CyberdeckRollingPickerProps) {
  const useWheelMomentum = wheelMomentum ?? true;
  const useExpandMomentum = wheelExpandOnScroll || wheelPinnedOpen;
  const resolvedMomentumGain =
    wheelMomentumGain ??
    (useExpandMomentum ? EXPAND_WHEEL_MOMENTUM_GAIN : COMPACT_WHEEL_MOMENTUM_GAIN);
  const resolvedMomentumFriction =
    wheelMomentumFriction ??
    (useExpandMomentum ? EXPAND_WHEEL_MOMENTUM_FRICTION : COMPACT_WHEEL_MOMENTUM_FRICTION);
  const resolvedMomentumDuration =
    wheelMomentumDuration ??
    (useExpandMomentum ? EXPAND_WHEEL_MOMENTUM_DURATION : COMPACT_WHEEL_MOMENTUM_DURATION);
  const resolvedDragFlickScale = useExpandMomentum
    ? EXPAND_DRAG_FLICK_VELOCITY_SCALE
    : COMPACT_DRAG_FLICK_VELOCITY_SCALE;
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
  const wheelInitDoneRef = useRef(false);
  const neighborsVisibleRef = useRef(false);
  const [showLabels, setShowLabels] = useState(false);
  const [wheelSettled, setWheelSettled] = useState(true);
  const [centerIndex, setCenterIndex] = useState(0);

  const userDraggedRef = useRef(false);

  const maxNeighborSteps = Math.max(0, Math.floor((wheelNeighborCount - 1) / 2));
  const expandedWheelHeightPx = slideHeightPx * wheelNeighborCount;

  const iosPickerStyleOptions = useMemo(
    () => ({
      compact: true,
      rolodex: false,
      itemSizePx: slideHeightPx,
      maxNeighborSteps,
      centerEmphasis: wheelPinnedOpen,
    }),
    [slideHeightPx, maxNeighborSteps, wheelPinnedOpen],
  );

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
      const center = findClosestSnapIndex(embla);
      setCenterIndex(center);
      if (wheelPinnedOpen) {
        applyPinnedShowroomSlideStyles(embla, center, iosPickerStyleOptions);
        return;
      }
      applyIosPickerSlideStyles(embla, eventName, iosPickerStyleOptions);
    },
    [iosPickerStyleOptions, wheelPinnedOpen],
  );

  const applyPinnedWheelAtRest = useCallback(
    (embla: EmblaCarouselType) => {
      neighborsVisibleRef.current = true;
      setWheelSettled(true);
      const center = findClosestSnapIndex(embla);
      setCenterIndex(center);
      applyPinnedShowroomSlideStyles(embla, center, iosPickerStyleOptions);
    },
    [iosPickerStyleOptions],
  );

  const settleWheelNeighbors = useCallback(
    (embla: EmblaCarouselType, eventName?: string) => {
      if (wheelPinnedOpen) {
        applyPinnedWheelAtRest(embla);
      } else {
        hideNeighborPreviews(embla);
      }
    },
    [wheelPinnedOpen, applyPinnedWheelAtRest, hideNeighborPreviews],
  );

  const endProgrammaticScroll = useCallback((embla: EmblaCarouselType) => {
    isProgrammaticScrollRef.current = false;
  }, []);

  const wheelScrollStepRef = useRef(wheelScrollStep);
  wheelScrollStepRef.current = wheelScrollStep;
  const useWheelMomentumRef = useRef(useWheelMomentum);
  useWheelMomentumRef.current = useWheelMomentum;
  const momentumGainRef = useRef(resolvedMomentumGain);
  momentumGainRef.current = resolvedMomentumGain;
  const momentumFrictionRef = useRef(resolvedMomentumFriction);
  momentumFrictionRef.current = resolvedMomentumFriction;
  const momentumDurationRef = useRef(resolvedMomentumDuration);
  momentumDurationRef.current = resolvedMomentumDuration;
  const wheelPinnedOpenRef = useRef(wheelPinnedOpen);
  wheelPinnedOpenRef.current = wheelPinnedOpen;
  const dragFlickScaleRef = useRef(resolvedDragFlickScale);
  dragFlickScaleRef.current = resolvedDragFlickScale;

  const applyWheelMomentum = useCallback((embla: EmblaCarouselType, deltaY: number) => {
    const engine = embla.internalEngine();
    engine.scrollBody
      .useFriction(momentumFrictionRef.current)
      .useDuration(momentumDurationRef.current);
    engine.animation.start();
    engine.scrollTo.distance(deltaY * momentumGainRef.current, false);
  }, []);

  const boostDragFlick = useCallback((embla: EmblaCarouselType) => {
    if (!useWheelMomentumRef.current) return;
    const engine = embla.internalEngine();
    const velocity = engine.scrollBody.velocity();
    if (Math.abs(velocity) < 0.04) return;
    engine.scrollBody
      .useFriction(momentumFrictionRef.current)
      .useDuration(momentumDurationRef.current);
    engine.animation.start();
    engine.scrollTo.distance(velocity * dragFlickScaleRef.current, false);
  }, []);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    axis: "y",
    loop: items.length > 1 && items.length < 120,
    align: "center",
    containScroll: false as const,
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

  useEffect(() => {
    if (!emblaApi || !wheelExpandOnScroll || items.length === 0) return;

    const initWheel = () => {
      const root = emblaApi.rootNode();
      if (!root || root.clientHeight < 4) return false;
      emblaApi.reInit();
      const index = indexForValue(itemsRef.current, valueRef.current);
      isProgrammaticScrollRef.current = true;
      emblaApi.scrollTo(index, true);
      requestAnimationFrame(() => {
        endProgrammaticScroll(emblaApi);
        settleWheelNeighbors(emblaApi, "reInit");
      });
      return true;
    };

    if (!wheelInitDoneRef.current) {
      if (initWheel()) wheelInitDoneRef.current = true;
    } else {
      settleWheelNeighbors(emblaApi, "reInit");
    }

    const root = emblaApi.rootNode();
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        if (!initWheel()) return;
        wheelInitDoneRef.current = true;
      },
      { threshold: 0.01 },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, [
    emblaApi,
    wheelExpandOnScroll,
    settleWheelNeighbors,
    items.length,
    endProgrammaticScroll,
  ]);

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
        settleWheelNeighbors(emblaApi, "settle");
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
      }
    };

    const onScroll = () => {
      const engine = emblaApi.internalEngine();
      if (wheelExpandOnScroll && !engine.scrollBody.settled()) {
        showNeighborPreviews(emblaApi, "scroll");
      }
      if (engine.dragHandler.pointerDown()) return;
      if (!engine.scrollBody.settled()) return;
      if (useWheelMomentumRef.current && wheelExpandOnScroll) {
        showNeighborPreviews(emblaApi, "scroll");
      }
      if (useWheelMomentumRef.current) {
        ensureSnappedToCenter(emblaApi);
      }
    };

    const onPointerUp = () => {
      if (!useWheelMomentumRef.current) return;
      requestAnimationFrame(() => boostDragFlick(emblaApi));
    };

    emblaApi.on("select", onSelect);
    emblaApi.on("pointerDown", onPointerDown);
    emblaApi.on("pointerUp", onPointerUp);
    emblaApi.on("settle", onSettle);
    emblaApi.on("scroll", onScroll);
    emblaApi.rootNode().addEventListener("wheel", onWheel, { passive: false });

    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("pointerDown", onPointerDown);
      emblaApi.off("pointerUp", onPointerUp);
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
    boostDragFlick,
    settleWheelNeighbors,
    showNeighborPreviews,
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
      if (wheelExpandOnScroll) settleWheelNeighbors(emblaApi, "reInit");
      emblaApi.off("settle", onDone);
    };
    emblaApi.on("settle", onDone);
  }, [emblaApi, items.length, wheelExpandOnScroll, settleWheelNeighbors, endProgrammaticScroll]);

  useEffect(() => {
    if (!emblaApi || items.length === 0 || wheelExpandOnScroll) return;
    const index = indexForValue(items, value);
    if (emblaApi.selectedScrollSnap() === index) return;
    isProgrammaticScrollRef.current = true;
    emblaApi.scrollTo(index, true);
  }, [emblaApi, items.length, value, wheelExpandOnScroll]);

  useEffect(() => {
    if (!emblaApi || !wheelExpandOnScroll || items.length === 0) return;
    if (neighborsVisibleRef.current && !wheelPinnedOpen) return;
    const index = indexForValue(items, value);
    if (findClosestSnapIndex(emblaApi) === index) return;
    isProgrammaticScrollRef.current = true;
    emblaApi.scrollTo(index, true);
    const onDone = () => {
      endProgrammaticScroll(emblaApi);
      settleWheelNeighbors(emblaApi, "settle");
      emblaApi.off("settle", onDone);
    };
    emblaApi.on("settle", onDone);
  }, [
    emblaApi,
    items.length,
    value,
    wheelExpandOnScroll,
    wheelPinnedOpen,
    settleWheelNeighbors,
    endProgrammaticScroll,
  ]);

  const useLabelSlides = wheelSettledShowsSlide
    ? !wheelSettled
    : alwaysShowLabel || (showTextWhileScrolling && showLabels) || wheelExpandOnScroll;
  const renderLabelSlide = (item: CyberdeckRollingPickerItem, isActive: boolean) => {
    if (item.renderLabelSlide) return item.renderLabelSlide(isActive);
    if (item.labelSlide) return item.labelSlide;
    return (
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
  };

  const renderSlideContent = (item: CyberdeckRollingPickerItem, isActive: boolean) => {
    if (item.renderSlide) {
      // Pinned showroom: selection band = sample + name; off-band rows = name only (no snap swap).
      if (wheelPinnedOpen && item.renderLabelSlide) {
        if (isActive) {
          return item.renderSlide(isActive);
        }
        return item.renderLabelSlide(false);
      }
      return item.renderSlide(isActive);
    }
    if (
      wheelSettledShowsSlide &&
      wheelExpandOnScroll &&
      (wheelSettled || wheelPinnedOpen) &&
      isActive
    ) {
      return item.slide ?? renderLabelSlide(item, true);
    }
    if (wheelSettledShowsSlide && wheelPinnedOpen && wheelSettled && !isActive) {
      return item.labelSlide ?? renderLabelSlide(item, false);
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
        wheelPinnedOpen ? floatWheelStyles.showroomPinned : floatWheelStyles.inline,
        wheelPinnedOpen && floatWheelStyles.spinningHost,
        wheelTransparent && floatWheelStyles.panelTransparent,
        !wheelPinnedOpen && "min-w-[5.25rem] max-w-[10rem] shrink-0 touch-pan-y",
      )}
      style={{
        ["--float-wheel-row-px" as string]: `${slideHeightPx}px`,
        ...(wheelPinnedOpen
          ? { ["--float-wheel-visible-rows" as string]: `${wheelNeighborCount}` }
          : {}),
      }}
      aria-label={ariaLabel}
    >
      <div
        className={cn(
          floatWheelStyles.wheelStage,
          !wheelPinnedOpen && floatWheelStyles.spinning,
          wheelTransparent && floatWheelStyles.wheelStageTransparent,
        )}
        style={{ height: wheelPinnedOpen ? "100%" : expandedWheelHeightPx }}
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
    <div
      className={cn(
        "flex shrink-0 flex-col items-stretch",
        wheelExpandOnScroll && "overflow-visible",
        !wheelExpandOnScroll && "rounded border border-[#2d2d2d] bg-black",
      )}
      aria-label={wheelExpandOnScroll ? undefined : ariaLabel}
    >
      {viewport}
    </div>
  );
}
