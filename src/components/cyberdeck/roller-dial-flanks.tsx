"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const WHEEL_DELTA_TRIGGER_PX = 4;
const DIAL_SETTLE_MS = 150;

type RollDirection = -1 | 0 | 1;

function gearCorners(direction: RollDirection): { left: string; right: string } {
  if (direction < 0) return { left: "⌙", right: "⌐" };
  return { left: "⌐", right: "⌙" };
}

type RollerDialFlanksProps = {
  children: ReactNode;
  className?: string;
};

/** Fixed rail + knurl flanks; gear corners mirror while the wheel spins. */
export function RollerDialFlanks({ children, className }: RollerDialFlanksProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [direction, setDirection] = useState<RollDirection>(0);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerLastYRef = useRef(0);
  const pointerTrackingRef = useRef(false);

  const bumpDirection = useCallback((next: 1 | -1) => {
    setDirection(next);
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    settleTimerRef.current = setTimeout(() => {
      setDirection(0);
      settleTimerRef.current = null;
    }, DIAL_SETTLE_MS);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) < WHEEL_DELTA_TRIGGER_PX) return;
      bumpDirection(event.deltaY > 0 ? 1 : -1);
    };

    const onPointerDown = (event: PointerEvent) => {
      pointerTrackingRef.current = true;
      pointerLastYRef.current = event.clientY;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!pointerTrackingRef.current || event.buttons === 0) return;
      const deltaY = event.clientY - pointerLastYRef.current;
      if (Math.abs(deltaY) < WHEEL_DELTA_TRIGGER_PX) return;
      bumpDirection(deltaY > 0 ? 1 : -1);
      pointerLastYRef.current = event.clientY;
    };

    const endPointer = () => {
      pointerTrackingRef.current = false;
    };

    host.addEventListener("wheel", onWheel, { capture: true, passive: true });
    host.addEventListener("pointerdown", onPointerDown, { capture: true, passive: true });
    host.addEventListener("pointermove", onPointerMove, { capture: true, passive: true });
    host.addEventListener("pointerup", endPointer, { capture: true, passive: true });
    host.addEventListener("pointercancel", endPointer, { capture: true, passive: true });

    return () => {
      host.removeEventListener("wheel", onWheel, { capture: true });
      host.removeEventListener("pointerdown", onPointerDown, { capture: true });
      host.removeEventListener("pointermove", onPointerMove, { capture: true });
      host.removeEventListener("pointerup", endPointer, { capture: true });
      host.removeEventListener("pointercancel", endPointer, { capture: true });
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    };
  }, [bumpDirection]);

  const { left, right } = gearCorners(direction);
  const gearActive = direction !== 0;
  const railClass = "select-none font-mono text-[9px] leading-none text-[#5a5a5a]";
  const knurlClass = "select-none font-mono text-[9px] leading-none text-[#6a6a6a]";
  const gearClass = cn(
    "select-none font-mono text-[9px] leading-none",
    gearActive ? "text-emerald-300/90" : "text-[#7a7a7a]",
  );

  return (
    <div
      ref={hostRef}
      className={cn("flex shrink-0 items-center gap-0", className)}
      data-roller-dial-direction={direction === 0 ? "idle" : direction > 0 ? "down" : "up"}
    >
      <span className={railClass} aria-hidden>
        ╞
      </span>
      <span className={gearClass} aria-hidden>
        {left}
      </span>
      <span className={knurlClass} aria-hidden>
        ▐
      </span>
      {children}
      <span className={knurlClass} aria-hidden>
        ▌
      </span>
      <span className={gearClass} aria-hidden>
        {right}
      </span>
      <span className={railClass} aria-hidden>
        ╡
      </span>
    </div>
  );
}
