import type { EmblaCarouselType } from "embla-carousel";

export const IOS_PICKER_ITEM_SIZE_PX = 22;

export type IosPickerStyleOptions = {
  /** Gentler falloff for long lists (e.g. 328 figlet fonts). */
  compact?: boolean;
};

export function numberWithinRange(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

/** Embla iOS-style picker loop: scale + light rotateX from scroll progress. */
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
  const snapSpacing = snapCount > 1 ? 1 / (snapCount - 1) : 1;
  const minOpacity = compact ? 0.72 : 0.45;
  const maxRotate = compact ? 14 : 42;
  const opacityFalloff = compact ? 0.18 : 0.14;

  snapList.forEach((snap, snapIndex) => {
    let diffToTarget = snap - scrollProgress;
    const slidesInSnap = engine.slideRegistry[snapIndex] ?? [];

    slidesInSnap.forEach((slideIndex) => {
      if (
        isScrollEvent &&
        !compact &&
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
      const isCentered = stepsFromCenter < 0.55;
      const opacity = isCentered
        ? 1
        : numberWithinRange(1 - stepsFromCenter * opacityFalloff, minOpacity, 1);
      const rotateX = isCentered
        ? 0
        : numberWithinRange(diffToTarget / snapSpacing, -2.5, 2.5) *
          (-maxRotate / 2.5);
      const scale = isCentered
        ? 1
        : numberWithinRange(1 - stepsFromCenter * 0.06, 0.88, 1);

      const node = emblaApi.slideNodes()[slideIndex];
      if (!node) return;
      node.style.opacity = `${opacity}`;
      node.style.transform = compact
        ? `scale(${scale})`
        : `rotateX(${rotateX}deg) scale(${scale})`;
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

/** Snap carousel to the nearest slide when dragFree stops between items. */
export function snapPickerToNearest(emblaApi: EmblaCarouselType): boolean {
  const closest = findClosestSnapIndex(emblaApi);
  if (snapOffsetPx(emblaApi, closest) > SNAP_ALIGN_THRESHOLD_PX) {
    emblaApi.scrollTo(closest);
    return true;
  }
  return false;
}
