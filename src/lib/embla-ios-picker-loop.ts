import type { EmblaCarouselType } from "embla-carousel";

export const IOS_PICKER_ITEM_SIZE_PX = 22;

export type IosPickerStyleOptions = {
  /** Gentler opacity falloff for long lists (e.g. figlet fonts). */
  compact?: boolean;
  /** Stronger dimming off-center (showroom pinned wheel). */
  centerEmphasis?: boolean;
  /** Cylindrical rolodex: rotateX + translateZ on inner slide nodes. */
  rolodex?: boolean;
  /** Slide row height in px — used for translateZ radius. */
  itemSizePx?: number;
  /** Hide slides farther than N steps from center (e.g. 1 = one preview per side). */
  maxNeighborSteps?: number;
};

export function numberWithinRange(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

export function indexDistanceFromSnapCenter(
  index: number,
  centerIndex: number,
  count: number,
): number {
  if (count <= 1) return 0;
  const raw = Math.abs(index - centerIndex);
  return Math.min(raw, count - raw);
}

/**
 * Showroom pinned wheel — opacity from snap index, not scrollProgress (breaks on long lists).
 */
export function applyPinnedShowroomSlideStyles(
  emblaApi: EmblaCarouselType,
  centerIndex: number,
  options?: Pick<IosPickerStyleOptions, "maxNeighborSteps" | "centerEmphasis">,
): void {
  const snapCount = emblaApi.scrollSnapList().length;
  if (!snapCount) return;

  const maxNeighborSteps = options?.maxNeighborSteps ?? 1;
  const centerEmphasis = options?.centerEmphasis ?? false;
  const minOpacity = centerEmphasis ? 0.28 : 0.35;
  const opacityFalloff = centerEmphasis ? 0.4 : 0.22;

  emblaApi.slideNodes().forEach((_node, index) => {
    const node = pickerInnerNode(emblaApi, index);
    if (!node) return;

    const stepsFromCenter = indexDistanceFromSnapCenter(index, centerIndex, snapCount);
    if (stepsFromCenter > maxNeighborSteps + 0.01) {
      node.style.opacity = "0";
      node.style.transform = "scale(0.82)";
      node.style.pointerEvents = "none";
      return;
    }

    const isCentered = stepsFromCenter < 0.55;
    const opacity = isCentered
      ? 1
      : numberWithinRange(1 - stepsFromCenter * opacityFalloff, minOpacity, 1);
    const scale = isCentered
      ? 1
      : numberWithinRange(1 - stepsFromCenter * 0.08, 0.82, 1);

    node.style.pointerEvents = isCentered ? "" : "none";
    node.style.opacity = `${opacity}`;
    node.style.transform = isCentered ? "" : `scale(${scale})`;
  });
}

function pickerInnerNode(emblaApi: EmblaCarouselType, slideIndex: number): HTMLElement | null {
  const slide = emblaApi.slideNodes()[slideIndex];
  if (!slide) return null;
  const inner = slide.querySelector<HTMLElement>("[data-ios-picker-inner]");
  return inner ?? slide;
}

/** Embla [iOS-style picker](https://www.embla-carousel.com/docs/examples/predefined#ios-style-picker-default): 3D rolodex from scroll progress. */
export function applyIosPickerSlideStyles(
  emblaApi: EmblaCarouselType,
  eventName?: string,
  options?: IosPickerStyleOptions,
): void {
  const engine = emblaApi.internalEngine();
  const scrollProgress = emblaApi.scrollProgress();
  const isScrollEvent = eventName === "scroll";
  const snapList = emblaApi.scrollSnapList();
  const snapCount = snapList.length;
  if (!snapCount) return;

  const compact = options?.compact ?? false;
  const centerEmphasis = options?.centerEmphasis ?? false;
  const rolodex = options?.rolodex ?? false;
  const maxNeighborSteps = options?.maxNeighborSteps;
  const itemSize = options?.itemSizePx ?? IOS_PICKER_ITEM_SIZE_PX;
  const snapSpacing = snapCount > 1 ? 1 / (snapCount - 1) : 1;
  const minOpacity = centerEmphasis ? 0.2 : compact ? 0.35 : 0.2;
  const maxRotate = compact ? 22 : 48;
  const opacityFalloff = centerEmphasis ? 0.4 : compact ? 0.22 : 0.14;
  const wheelRadius = (itemSize * Math.max(snapCount, 3)) / (2 * Math.PI);

  snapList.forEach((snap, snapIndex) => {
    let diffToTarget = snap - scrollProgress;
    const slidesInSnap = engine.slideRegistry[snapIndex] ?? [];

    slidesInSnap.forEach((slideIndex) => {
      if (
        isScrollEvent &&
        !compact &&
        !rolodex &&
        !emblaApi.slidesInView().includes(slideIndex)
      ) {
        return;
      }

      if (engine.options.loop) {
        engine.slideLooper.loopPoints.forEach((loopItem) => {
          const target = loopItem.target();
          if (slideIndex === loopItem.index && target !== 0) {
            const sign = Math.sign(target);
            if (sign === -1) {
              diffToTarget = snap - (1 + scrollProgress);
            }
            if (sign === 1) {
              diffToTarget = snap + (1 - scrollProgress);
            }
          }
        });
      }

      const stepsFromCenter = Math.abs(diffToTarget) / snapSpacing;
      const stepSigned = diffToTarget / snapSpacing;

      const node = pickerInnerNode(emblaApi, slideIndex);
      if (!node) return;

      if (maxNeighborSteps != null && stepsFromCenter > maxNeighborSteps + 0.35) {
        node.style.opacity = "0";
        node.style.transform = "scale(0.82)";
        node.style.pointerEvents = "none";
        return;
      }
      node.style.pointerEvents = "";

      const isCentered = stepsFromCenter < 0.55;
      const opacity = isCentered
        ? 1
        : numberWithinRange(1 - stepsFromCenter * opacityFalloff, minOpacity, 1);
      const rotateX = isCentered
        ? 0
        : numberWithinRange(stepSigned, -2.5, 2.5) * (-maxRotate / 2.5);
      const scale = isCentered
        ? 1
        : numberWithinRange(1 - stepsFromCenter * 0.08, 0.82, 1);

      let transform = `scale(${scale})`;
      if (rolodex) {
        const angleRad = stepSigned * (Math.PI / 7);
        const translateZ = wheelRadius * (Math.cos(angleRad) - 1);
        transform = `translateZ(${translateZ.toFixed(2)}px) rotateX(${rotateX.toFixed(2)}deg) scale(${scale})`;
      } else if (!compact) {
        transform = `rotateX(${rotateX.toFixed(2)}deg) scale(${scale})`;
      }

      node.style.opacity = `${opacity}`;
      node.style.transform = transform;
    });
  });
}

export function indexForPickerValue(values: readonly string[], target: string): number {
  const idx = values.findIndex((v) => v.toLowerCase() === target.toLowerCase());
  return idx >= 0 ? idx : 0;
}

const SNAP_ALIGN_THRESHOLD_PX = 0.5;

/** Nearest snap index from scroll position in px (for dragFree centering). */
export function findClosestSnapIndex(emblaApi: EmblaCarouselType): number {
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

export function snapOffsetPx(emblaApi: EmblaCarouselType, index: number): number {
  const { scrollSnaps, location } = emblaApi.internalEngine();
  return Math.abs((scrollSnaps[index] ?? 0) - location.get());
}

/** True when scroll position is not centered on a snap. */
export function pickerNeedsSnapToCenter(emblaApi: EmblaCarouselType): boolean {
  const closest = findClosestSnapIndex(emblaApi);
  return (
    snapOffsetPx(emblaApi, closest) > SNAP_ALIGN_THRESHOLD_PX ||
    emblaApi.selectedScrollSnap() !== closest
  );
}

/** Animate to the nearest snap — call on settle / pointerUp after dragFree. */
export function ensurePickerSnappedToCenter(emblaApi: EmblaCarouselType): boolean {
  const closest = findClosestSnapIndex(emblaApi);
  if (!pickerNeedsSnapToCenter(emblaApi)) return false;
  emblaApi.scrollTo(closest);
  return true;
}

/** @deprecated Use ensurePickerSnappedToCenter */
export function snapPickerToNearest(emblaApi: EmblaCarouselType): boolean {
  return ensurePickerSnappedToCenter(emblaApi);
}
