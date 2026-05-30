'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { EmblaCarouselType } from 'embla-carousel';
import useEmblaCarousel from 'embla-carousel-react';
import { cn } from '@/lib/utils';
import {
  applyIosPickerSlideStyles,
  findClosestSnapIndex,
  indexForPickerValue,
  ensurePickerSnappedToCenter,
} from '@/lib/embla-ios-picker-loop';
import styles from '@/components/cyberdeck/figlet-ios-picker.module.css';

const WHEEL_DELTA_TRIGGER_PX = 4;

export type CyberdeckIosStylePickerItem = {
  value: string;
  label: string;
  slide: ReactNode;
};

export type CyberdeckIosStylePickerProps = {
  items: CyberdeckIosStylePickerItem[];
  value: string;
  onChange: (value: string) => void;
  onUserSelect?: (value: string) => void;
  onCenterIndexChange?: (index: number) => void;
  ariaLabel: string;
  slideHeight?: number;
  visibleSlides?: number;
  /** Softer opacity curve for long lists (figlet). */
  compact?: boolean;
  className?: string;
};

function normalizeIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return ((index % count) + count) % count;
}

/**
 * iOS rolodex wheel — 3D perspective + fading neighbors
 * ([Embla iOS picker](https://www.embla-carousel.com/docs/examples/predefined#ios-style-picker-default)).
 */
export function CyberdeckIosStylePicker({
  items,
  value,
  onChange,
  onUserSelect,
  onCenterIndexChange,
  ariaLabel,
  slideHeight = 34,
  visibleSlides = 5,
  compact = false,
  className,
}: CyberdeckIosStylePickerProps) {
  const valueRef = useRef(value);
  valueRef.current = value;

  const itemsRef = useRef(items);
  itemsRef.current = items;

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const onUserSelectRef = useRef(onUserSelect);
  onUserSelectRef.current = onUserSelect;

  const onCenterIndexChangeRef = useRef(onCenterIndexChange);
  onCenterIndexChangeRef.current = onCenterIndexChange;

  const isProgrammaticScrollRef = useRef(false);
  const itemsLengthRef = useRef(items.length);
  const userDraggedRef = useRef(false);

  const [wheelReady, setWheelReady] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const viewportHeight = slideHeight * visibleSlides;

  const styleOptions = useRef({ compact, rolodex: true as const, itemSizePx: slideHeight });
  styleOptions.current = { compact, rolodex: true, itemSizePx: slideHeight };

  const [emblaRef, emblaApi] = useEmblaCarousel({
    axis: 'y',
    loop: items.length > 1,
    align: 'center',
    containScroll: false,
    dragFree: true,
    duration: 24,
    watchDrag: true,
  });

  const applyWheelStyles = useCallback(
    (embla: EmblaCarouselType, eventName?: string) => {
      if (!wheelReady) return;
      applyIosPickerSlideStyles(embla, eventName, styleOptions.current);
      const center = findClosestSnapIndex(embla);
      setSelectedIndex(center);
      onCenterIndexChangeRef.current?.(center);
    },
    [wheelReady],
  );

  const commitSelection = useCallback((embla: EmblaCarouselType) => {
    const list = itemsRef.current;
    if (list.length === 0) return;
    const index = findClosestSnapIndex(embla);
    const entry = list[normalizeIndex(index, list.length)];
    if (!entry || entry.value === valueRef.current) return;
    onChangeRef.current(entry.value);
  }, []);

  const ensureSnappedToCenter = useCallback((embla: EmblaCarouselType): boolean => {
    if (!ensurePickerSnappedToCenter(embla)) return false;
    isProgrammaticScrollRef.current = true;
    return true;
  }, []);

  const ensureSnappedToCenterRef = useRef(ensureSnappedToCenter);
  ensureSnappedToCenterRef.current = ensureSnappedToCenter;

  const initWheel3d = useCallback(
    (embla: EmblaCarouselType) => {
      setWheelReady(false);
      embla.reInit();
      requestAnimationFrame(() => {
        applyIosPickerSlideStyles(embla, 'reInit', styleOptions.current);
        const center = findClosestSnapIndex(embla);
        setSelectedIndex(center);
        onCenterIndexChangeRef.current?.(center);
        setWheelReady(true);
      });
    },
    [],
  );

  useEffect(() => {
    if (!emblaApi) return;
    initWheel3d(emblaApi);
  }, [emblaApi, initWheel3d, items.length, slideHeight, compact]);

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
    };

    const onWheel = (event: WheelEvent) => {
      if (isProgrammaticScrollRef.current) return;
      if (itemsRef.current.length <= 1) return;
      if (Math.abs(event.deltaY) < WHEEL_DELTA_TRIGGER_PX) return;

      event.preventDefault();
      event.stopPropagation();
      userDraggedRef.current = true;

      const direction = event.deltaY > 0 ? 1 : -1;
      const currentIndex = findClosestSnapIndex(emblaApi);
      const nextIndex = normalizeIndex(currentIndex + direction, itemsRef.current.length);
      isProgrammaticScrollRef.current = true;
      emblaApi.scrollTo(nextIndex);
    };

    const onSettle = () => {
      if (ensureSnappedToCenterRef.current(emblaApi)) return;

      isProgrammaticScrollRef.current = false;
      commitSelection(emblaApi);
      applyWheelStyles(emblaApi, 'settle');

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

    const onPointerUp = () => {
      if (!userDraggedRef.current) return;
      ensureSnappedToCenterRef.current(emblaApi);
    };

    const onScroll = () => {
      applyWheelStyles(emblaApi, 'scroll');
      const engine = emblaApi.internalEngine();
      if (engine.dragHandler.pointerDown()) return;
      if (!engine.scrollBody.settled()) return;
      ensureSnappedToCenterRef.current(emblaApi);
    };

    emblaApi.on('select', onSelect);
    emblaApi.on('pointerDown', onPointerDown);
    emblaApi.on('pointerUp', onPointerUp);
    emblaApi.on('settle', onSettle);
    emblaApi.on('scroll', onScroll);
    emblaApi.rootNode().addEventListener('wheel', onWheel, { passive: false });

    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('pointerDown', onPointerDown);
      emblaApi.off('pointerUp', onPointerUp);
      emblaApi.off('settle', onSettle);
      emblaApi.off('scroll', onScroll);
      emblaApi.rootNode().removeEventListener('wheel', onWheel);
    };
  }, [emblaApi, applyWheelStyles, commitSelection]);

  useEffect(() => {
    if (!emblaApi) return;
    if (itemsLengthRef.current === items.length) return;
    itemsLengthRef.current = items.length;
    isProgrammaticScrollRef.current = true;
    initWheel3d(emblaApi);
    emblaApi.scrollTo(indexForPickerValue(itemsRef.current.map((i) => i.value), valueRef.current), true);
  }, [emblaApi, initWheel3d, items.length]);

  useEffect(() => {
    if (!emblaApi || items.length === 0) return;
    const index = indexForPickerValue(
      items.map((item) => item.value),
      value,
    );
    if (emblaApi.selectedScrollSnap() === index) return;
    isProgrammaticScrollRef.current = true;
    emblaApi.scrollTo(index, true);
  }, [emblaApi, items, value]);

  const cssVars = {
    '--ios-picker-item-size': `${slideHeight}px`,
    '--ios-picker-height': `${viewportHeight}px`,
    '--ios-picker-width': '6.75rem',
  } as CSSProperties;

  if (items.length === 0) {
    return (
      <div
        className={cn(styles.viewport, className)}
        style={{ ...cssVars, height: viewportHeight }}
      >
        <span className="font-mono text-[8px] text-[#6a6a6a]">…</span>
      </div>
    );
  }

  return (
    <div
      className={cn(styles.picker, className)}
      style={cssVars}
      aria-label={ariaLabel}
    >
      <div ref={emblaRef} className={styles.viewport}>
        <div className={styles.container}>
          {items.map((item, index) => (
            <div
              key={item.value}
              className={cn(styles.slide, index === selectedIndex && styles.slideSelected)}
            >
              <div data-ios-picker-inner className={styles.slideInner}>
                {item.slide}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
