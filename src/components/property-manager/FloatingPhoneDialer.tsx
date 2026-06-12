"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MdLocalPhone } from "react-icons/md";
import { motion, useDragControls } from "motion/react";
import { PhoneDialer } from "@/components/property-manager/PhoneDialer";
import {
  fetchDialerState,
  type DialerState,
  type SelectedCaseDialerContext,
} from "@/lib/property-manager/call-sessions";
import { cn } from "@/lib/utils";

type FloatingPhoneDialerProps = {
  boundaryElement: HTMLElement | null;
  selectedCase: SelectedCaseDialerContext | null;
  onCallEnded?: () => void;
};

type ConstraintBox = {
  top: number;
  left: number;
  width: number;
  height: number;
};

function isPhoneBusy(state: DialerState): boolean {
  return Boolean(state.active) || Boolean(state.incoming);
}

function resolveConstraintElement(boundary: HTMLElement | null): HTMLElement | null {
  if (!boundary) return null;
  return (
    (boundary.closest(".cyberdeck-net-pane.right") as HTMLElement | null) ??
    (boundary.closest("[data-phone-dialer-boundary]") as HTMLElement | null) ??
    boundary
  );
}

function rectToBox(rect: DOMRect): ConstraintBox | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

/** Keep the drag surface in the visible viewport so bottom-anchored dialer stays reachable. */
function clampBoxToViewport(box: ConstraintBox): ConstraintBox {
  if (typeof window === "undefined") return box;

  const viewportRight = window.innerWidth;
  const viewportBottom = window.innerHeight;
  const left = Math.max(0, box.left);
  const top = Math.max(0, box.top);
  const right = Math.min(viewportRight, box.left + box.width);
  const bottom = Math.min(viewportBottom, box.top + box.height);

  return {
    left,
    top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

function useConstraintBox(constraintElement: HTMLElement | null): ConstraintBox | null {
  const [box, setBox] = useState<ConstraintBox | null>(null);

  useLayoutEffect(() => {
    if (!constraintElement) {
      setBox(null);
      return;
    }

    const update = () => {
      setBox(rectToBox(constraintElement.getBoundingClientRect()));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(constraintElement);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [constraintElement]);

  return box;
}

/**
 * Draggable phone dialer portaled above the page (z-index 9999).
 * Drag bounds match the cyberdeck right pane or property-manager boundary.
 * @see https://examples.motion.dev/react/drag-constraints
 */
export function FloatingPhoneDialer({
  boundaryElement,
  selectedCase,
  onCallEnded,
}: FloatingPhoneDialerProps) {
  const dragControls = useDragControls();
  const dragSurfaceRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [phoneState, setPhoneState] = useState<DialerState>({
    incoming: null,
    active: null,
    recent: [],
  });
  const dialerSyncGen = useRef(0);

  const constraintElement = resolveConstraintElement(boundaryElement);
  const box = useConstraintBox(constraintElement);

  useEffect(() => {
    setMounted(true);
  }, []);

  const applyDialerState = useCallback((next: DialerState) => {
    dialerSyncGen.current += 1;
    setPhoneState(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      const generation = dialerSyncGen.current;
      try {
        const next = await fetchDialerState();
        if (!cancelled && generation === dialerSyncGen.current) {
          setPhoneState(next);
        }
      } catch {
        // ignore polling errors
      }
    };
    void sync();
    const interval = window.setInterval(sync, 3_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (isPhoneBusy(phoneState)) {
      setExpanded(true);
    }
  }, [phoneState]);

  const handleCallEnded = () => {
    onCallEnded?.();
  };

  if (!mounted || !boundaryElement) return null;

  const rawBox =
    box ??
    rectToBox(constraintElement?.getBoundingClientRect() ?? boundaryElement.getBoundingClientRect());
  const effectiveBox = rawBox ? clampBoxToViewport(rawBox) : null;

  if (!effectiveBox || effectiveBox.width <= 0 || effectiveBox.height <= 0) return null;

  const phoneUi = (
    <>
      <motion.button
        type="button"
        data-testid="property-manager-phone-dialer-fab"
        aria-label="Open property manager phone"
        drag={!expanded}
        dragConstraints={dragSurfaceRef}
        dragElastic={0.15}
        dragMomentum={false}
        className={cn(
          "pointer-events-auto absolute bottom-4 right-4 flex h-14 w-14 items-center justify-center rounded-full border shadow-lg",
          expanded && "pointer-events-none invisible opacity-0",
          phoneState.incoming
            ? "border-rose-400/70 bg-rose-950/90 text-rose-100 shadow-rose-900/40 animate-pulse"
            : "border-emerald-500/50 bg-[#030806] text-emerald-300 shadow-emerald-900/30 hover:border-emerald-400/70 hover:text-emerald-200",
        )}
        onClick={() => setExpanded(true)}
      >
        <MdLocalPhone className="h-7 w-7" aria-hidden />
      </motion.button>
      <motion.div
        data-testid="property-manager-phone-dialer"
        drag={expanded}
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={dragSurfaceRef}
        dragElastic={0.12}
        dragMomentum={false}
        className={cn(
          "pointer-events-auto absolute bottom-4 right-4 flex w-[min(100%,21rem)] flex-col overflow-hidden rounded-md border border-[#25352c] bg-[#030806]/95 shadow-2xl shadow-black/60 backdrop-blur-sm",
          !expanded && "pointer-events-none invisible opacity-0",
        )}
      >
        <div
          className="flex shrink-0 cursor-grab items-center justify-between border-b border-[#25352c] bg-black/80 px-2 py-1 active:cursor-grabbing"
          onPointerDown={(event) => dragControls.start(event)}
        >
          <span className="font-mono text-[7px] tracking-[0.14em] text-[#606060]">DRAG</span>
          <button
            type="button"
            aria-label="Minimize phone"
            className="rounded-sm px-2 py-0.5 font-mono text-[10px] text-[#8a8a8a] hover:bg-[#1a1a1a] hover:text-emerald-300"
            onClick={() => setExpanded(false)}
          >
            ×
          </button>
        </div>
        <div
          data-testid="property-manager-phone-dialer-body"
          className="min-h-0 max-h-[min(72vh,28rem)] overflow-y-auto overflow-x-hidden"
        >
          <PhoneDialer
            floating
            selectedCase={selectedCase}
            remoteState={phoneState}
            onStateChange={applyDialerState}
            onCallEnded={handleCallEnded}
          />
        </div>
      </motion.div>
    </>
  );

  return createPortal(
    <div
      data-phone-dialer
      data-phone-dialer-layout="floating"
      data-deck-mode="ascii"
      data-morphism="asciimorphism"
      className="pointer-events-none fixed z-[9999]"
      style={{
        top: effectiveBox.top,
        left: effectiveBox.left,
        width: effectiveBox.width,
        height: effectiveBox.height,
      }}
    >
      <div ref={dragSurfaceRef} className="relative h-full w-full">
        {phoneUi}
      </div>
    </div>,
    document.body,
  );
}
