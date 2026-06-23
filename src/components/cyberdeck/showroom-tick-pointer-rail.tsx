"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const SPIN_IDLE_MS = 160;
const TICK_FLASH_MS = 70;
const LOCK_FLASH_MS = 220;
const TICKS_PER_SIDE = 14;

type ShowroomTickPointerRailProps = {
  children: ReactNode;
  /** Embla slide row height — one peg per font slot. */
  slideHeightPx?: number;
  className?: string;
};

function readEmblaTranslateY(host: HTMLElement): number | null {
  const picker = host.querySelector("[data-testid='realm-roller-picker']");
  if (!picker) return null;

  const viewport =
    picker.querySelector("[data-float-wheel-stage] > div") ??
    picker.querySelector("[data-float-wheel-panel] [class*='viewport']");
  const container = viewport?.firstElementChild;
  if (!(container instanceof HTMLElement)) return null;

  const transform = getComputedStyle(container).transform;
  if (transform === "none") return 0;

  const matrix = new DOMMatrix(transform);
  return matrix.m42;
}

function buildTickStrip(length: number): string[] {
  const ticks: string[] = [];
  for (let i = 0; i < length; i += 1) {
    ticks.push(i % 2 === 0 ? "┤" : "╶");
  }
  return ticks;
}

/** Price Is Right peg rail — fixed flapper, ticks scroll with the wheel. */
export function ShowroomTickPointerRail({
  children,
  slideHeightPx = 44,
  className,
}: ShowroomTickPointerRailProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [tickOffsetPx, setTickOffsetPx] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [deflected, setDeflected] = useState(false);
  const [locked, setLocked] = useState(false);

  const lastTranslateRef = useRef(0);
  const lastMotionAtRef = useRef(0);
  const lastPegIndexRef = useRef(0);
  const wasSpinningRef = useRef(false);
  const deflectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashDeflect = useCallback(() => {
    setDeflected(true);
    if (deflectTimerRef.current) clearTimeout(deflectTimerRef.current);
    deflectTimerRef.current = setTimeout(() => {
      setDeflected(false);
      deflectTimerRef.current = null;
    }, TICK_FLASH_MS);
  }, []);

  const flashLock = useCallback(() => {
    setLocked(true);
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    lockTimerRef.current = setTimeout(() => {
      setLocked(false);
      lockTimerRef.current = null;
    }, LOCK_FLASH_MS);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let rafId = 0;

    const sample = (time: number) => {
      const translateY = readEmblaTranslateY(host);
      if (translateY !== null) {
        setTickOffsetPx(translateY);

        if (Math.abs(translateY - lastTranslateRef.current) > 0.35) {
          lastMotionAtRef.current = time;
        }
        lastTranslateRef.current = translateY;

        const pegIndex = Math.round(translateY / slideHeightPx);
        if (pegIndex !== lastPegIndexRef.current) {
          lastPegIndexRef.current = pegIndex;
          flashDeflect();
        }

        const active = time - lastMotionAtRef.current < SPIN_IDLE_MS;
        setSpinning(active);

        if (wasSpinningRef.current && !active) {
          flashLock();
        }
        wasSpinningRef.current = active;
      }

      rafId = requestAnimationFrame(sample);
    };

    rafId = requestAnimationFrame(sample);

    return () => {
      cancelAnimationFrame(rafId);
      if (deflectTimerRef.current) clearTimeout(deflectTimerRef.current);
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    };
  }, [flashDeflect, flashLock, slideHeightPx]);

  const tickStepPx = slideHeightPx / 2;
  const ticks = buildTickStrip(TICKS_PER_SIDE * 2);
  const pegClass = cn(
    "block text-center leading-none",
    spinning ? "text-[#8a8a8a]" : "text-[#5f5f5f]",
  );
  const gapClass = cn(
    "block text-center leading-none",
    spinning ? "text-[#3f3f3f]" : "text-[#2f2f2f]",
  );

  const pointerGlyph = locked ? "►" : deflected ? "▸" : "▶";

  return (
    <div
      ref={hostRef}
      className={cn("flex min-h-0 min-w-0 flex-1 items-stretch", className)}
      data-showroom-tick-rail
      data-showroom-tick-spinning={spinning ? "true" : "false"}
      data-showroom-tick-locked={locked ? "true" : "false"}
    >
      <div
        className="relative w-3 shrink-0 overflow-hidden"
        aria-hidden
        data-showroom-tick-peg-rail
      >
        <div
          className="absolute left-0 top-1/2 w-full font-mono text-[9px] leading-[11px]"
          style={{
            transform: `translateY(calc(-50% + ${tickOffsetPx}px))`,
          }}
        >
          {ticks.map((glyph, index) => (
            <span key={index} className={glyph === "┤" ? pegClass : gapClass}>
              {glyph}
            </span>
          ))}
        </div>

        <div
          className={cn(
            "pointer-events-none absolute left-0 top-1/2 z-10 -translate-y-1/2 font-mono text-[10px] leading-none transition-colors duration-75",
            locked
              ? "text-emerald-300"
              : deflected
                ? "text-emerald-200/90"
                : spinning
                  ? "text-[#9a9a9a]"
                  : "text-[#6a6a6a]",
          )}
          data-showroom-tick-pointer
        >
          {pointerGlyph}
        </div>
      </div>

      <div className="min-h-0 min-w-0 flex-1">{children}</div>

      <div
        className="flex w-2 shrink-0 flex-col items-center justify-center gap-[11px] overflow-hidden font-mono text-[9px] leading-none text-[#3a3a3a]"
        aria-hidden
        data-showroom-tick-knurl
      >
        {Array.from({ length: 5 }, (_, index) => (
          <span
            key={index}
            className={cn(spinning && index === 2 && "text-[#5a5a5a]")}
            style={{
              transform: spinning
                ? `translateY(${((tickOffsetPx / tickStepPx) % 2) * (index % 2 === 0 ? 1 : -1)}px)`
                : undefined,
            }}
          >
            ▪
          </span>
        ))}
      </div>
    </div>
  );
}
