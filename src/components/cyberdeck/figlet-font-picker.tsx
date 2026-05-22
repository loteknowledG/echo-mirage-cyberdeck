'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { LuType } from "react-icons/lu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import styles from "@/components/cyberdeck/figlet-ios-picker.module.css";
import {
  applyIosPickerSlideStyles,
  findClosestSnapIndex,
  indexForPickerValue,
  IOS_PICKER_ITEM_SIZE_PX,
  snapPickerToNearest,
} from "@/lib/embla-ios-picker-loop";
import { DEFAULT_FIGLET_FONT } from "@/lib/figlet-fonts";

const TOOLTIP_CLASS =
  "z-50 rounded border border-[#2d2d2d] bg-black px-2 py-1 text-right font-mono text-[9px] tracking-[0.06em] text-emerald-200 shadow-md";

type FigletFontPickerProps = {
  value: string;
  onChange: (font: string) => void;
  /** Called when the user finishes spinning the font wheel (snap settled). */
  onWheelSettled?: () => void;
};

/** Figlet font wheel — Embla iOS-style picker loop (y-axis, loop, dragFree). */
export function FigletFontPicker({ value, onChange, onWheelSettled }: FigletFontPickerProps) {
  const [fonts, setFonts] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const fontsRef = useRef(fonts);
  fontsRef.current = fonts;
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onWheelSettledRef = useRef(onWheelSettled);
  onWheelSettledRef.current = onWheelSettled;
  const isSyncingRef = useRef(false);
  const fontsLengthRef = useRef(0);
  const styleFrameRef = useRef<number | null>(null);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    axis: "y",
    loop: true,
    dragFree: true,
    containScroll: false,
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/glyph/fonts");
        const payload = (await res.json()) as { ok?: boolean; fonts?: string[]; error?: string };
        if (!mounted) return;
        if (!payload.ok || !Array.isArray(payload.fonts)) {
          setLoadError(payload.error || "Font list unavailable");
          setFonts([DEFAULT_FIGLET_FONT]);
          return;
        }
        setFonts(payload.fonts);
        setLoadError(null);
      } catch (err) {
        if (!mounted) return;
        setLoadError(err instanceof Error ? err.message : "Font list failed");
        setFonts([DEFAULT_FIGLET_FONT]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const paintWheel = useCallback(
    (eventName?: string) => {
      if (!emblaApi) return;
      applyIosPickerSlideStyles(emblaApi, eventName, { compact: true });
    },
    [emblaApi],
  );

  const schedulePaint = useCallback(
    (eventName?: string) => {
      if (styleFrameRef.current !== null) return;
      styleFrameRef.current = requestAnimationFrame(() => {
        styleFrameRef.current = null;
        paintWheel(eventName);
      });
    },
    [paintWheel],
  );

  const applySelection = useCallback(
    (index: number, emitChange: boolean) => {
      const normalized = fontsRef.current.length
        ? ((index % fontsRef.current.length) + fontsRef.current.length) %
          fontsRef.current.length
        : 0;
      setSelectedIndex(normalized);
      const font = fontsRef.current[normalized];
      if (emitChange && font && font !== valueRef.current) {
        onChangeRef.current(font);
      }
    },
    [],
  );

  const syncToValue = useCallback(
    (fontList: string[], fontValue: string, jump = true) => {
      if (!emblaApi || fontList.length === 0) return;
      const index = indexForPickerValue(fontList, fontValue);
      isSyncingRef.current = true;
      emblaApi.scrollTo(index, jump);
      applySelection(index, false);
      paintWheel();
    },
    [applySelection, emblaApi, paintWheel],
  );

  useEffect(() => {
    if (!emblaApi) return;

    const onScroll = () => {
      schedulePaint("scroll");
      if (!isSyncingRef.current) {
        applySelection(findClosestSnapIndex(emblaApi), false);
      }
    };

    const onSettle = () => {
      if (snapPickerToNearest(emblaApi)) {
        isSyncingRef.current = true;
        return;
      }
      isSyncingRef.current = false;
      const index = findClosestSnapIndex(emblaApi);
      applySelection(index, true);
      paintWheel("settle");
      onWheelSettledRef.current?.();
    };

    const onSelect = () => {
      if (isSyncingRef.current) return;
      applySelection(emblaApi.selectedScrollSnap(), true);
      paintWheel();
    };

    emblaApi.on("scroll", onScroll);
    emblaApi.on("settle", onSettle);
    emblaApi.on("select", onSelect);

    return () => {
      emblaApi.off("scroll", onScroll);
      emblaApi.off("settle", onSettle);
      emblaApi.off("select", onSelect);
      if (styleFrameRef.current !== null) {
        cancelAnimationFrame(styleFrameRef.current);
        styleFrameRef.current = null;
      }
    };
  }, [applySelection, emblaApi, paintWheel, schedulePaint]);

  useEffect(() => {
    if (!emblaApi || fonts.length === 0) return;
    if (fontsLengthRef.current === fonts.length) return;
    fontsLengthRef.current = fonts.length;
    emblaApi.reInit();
    syncToValue(fonts, valueRef.current, true);
  }, [emblaApi, fonts.length, fonts, syncToValue]);

  useEffect(() => {
    if (!emblaApi || fonts.length === 0 || isSyncingRef.current) return;
    const index = indexForPickerValue(fonts, value);
    const atCenter = fonts[findClosestSnapIndex(emblaApi)];
    if (atCenter?.toLowerCase() === value.toLowerCase()) {
      applySelection(index, false);
      return;
    }
    syncToValue(fonts, value, true);
  }, [applySelection, emblaApi, fonts, syncToValue, value]);

  const displayLabel =
    fonts.find((f) => f.toLowerCase() === value.toLowerCase()) ??
    fonts[selectedIndex] ??
    value;

  if (fonts.length === 0) {
    return (
      <div
        className="flex h-7 w-[4.75rem] shrink-0 items-center justify-center rounded border border-[#2d2d2d] bg-black font-mono text-[8px] text-[#6a6a6a]"
        title={loadError ?? "Loading fonts"}
      >
        …
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex shrink-0 items-center gap-1" title={loadError ?? undefined}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex shrink-0 cursor-default" tabIndex={-1}>
              <LuType className="h-3 w-3 text-emerald-500/70" aria-hidden />
            </span>
          </TooltipTrigger>
          <TooltipContent side="right" align="start" sideOffset={6} className={TOOLTIP_CLASS}>
            {displayLabel}
          </TooltipContent>
        </Tooltip>

        <div
          className={styles.picker}
          style={
            {
              "--ios-picker-item-size": `${IOS_PICKER_ITEM_SIZE_PX}px`,
              "--ios-picker-width": "4.75rem",
            } as CSSProperties
          }
        >
          <div
            ref={emblaRef}
            className={styles.viewport}
            aria-label="Figlet font"
            title={displayLabel}
          >
            <div className={styles.container}>
              {fonts.map((font, index) => (
                <div
                  key={font}
                  className={`${styles.slide} ${
                    index === selectedIndex ? styles.slideSelected : ""
                  }`}
                >
                  <span className={styles.slideLabel}>{font}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
