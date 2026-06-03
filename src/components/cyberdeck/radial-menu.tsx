"use client";

import { useMemo, useRef, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const MENU_ITEMS = [
  { label: "Voice", icon: "V", tooltip: "Voice" },
  { label: "Logs", icon: "L", tooltip: "Logs" },
  { label: "Tools", icon: "T", tooltip: "Tools" },
  { label: "Power", icon: "P", tooltip: "Power" },
  { label: "Mode", icon: "M", tooltip: "Mode" },
] as const;

const START_ANGLE = -90;
const ROTATION_ANGLE = 360;
const ROTATION_ANGLE_INCLUSIVE = false;
const RADIUS_REM = 4.2;

function radialItemAngles(count: number): number[] {
  const itemCount = ROTATION_ANGLE_INCLUSIVE ? count - 1 : count;
  const increment =
    count > 1 ? Math.round(ROTATION_ANGLE / itemCount) : 0;
  return Array.from({ length: count }, (_, index) => START_ANGLE + index * increment);
}

function TwoPositionFace({ label }: { label: string }) {
  return (
    <div className="group relative flex h-11 w-11 items-center justify-center rounded-full border border-cyan-500/10 bg-slate-950/40 font-mono text-sm font-bold tracking-wider text-cyan-400/80 transition-all duration-200 hover:border-cyan-400/40 hover:text-cyan-200 hover:shadow-[0_0_12px_rgba(34,211,238,0.2)]">
      <div className="absolute left-[3px] top-[3px] h-1 w-1 border-l border-t border-cyan-400/30 group-hover:border-cyan-400" />
      <div className="absolute bottom-[3px] right-[3px] h-1 w-1 border-b border-r border-cyan-400/30 group-hover:border-cyan-400" />
      <span className="relative top-[-0.5px] select-none">{label}</span>
    </div>
  );
}

function DialFace({ open = false }: { open?: boolean }) {
  return (
    <div className="relative grid h-20 w-20 place-items-center transition-transform duration-300">
      <div
        className="absolute inset-0 rounded-full transition-transform duration-500 ease-out"
        style={{
          background:
            "radial-gradient(circle at 30% 28%, rgba(255,255,255,0.15) 0%, rgba(30,41,59,0.95) 35%, rgba(15,23,42,1) 75%, rgba(2,6,23,1) 100%)",
          boxShadow: open
            ? "inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -4px 12px rgba(0,0,0,0.8), 0 0 24px rgba(34,211,238,0.3)"
            : "inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -6px 14px rgba(0,0,0,0.7), 0 0 12px rgba(34,211,238,0.08)",
          transform: `rotate(${open ? 180 : 0}deg)`,
        }}
      />
      <div className="absolute inset-[4px] rounded-full border border-cyan-400/20 bg-slate-900/90" />
      <div className="absolute inset-[10px] rounded-full border border-dashed border-cyan-500/10 bg-transparent" />
      <div
        className={cn(
          "absolute left-1/2 top-1/2 h-[1px] w-[60%] -translate-x-1/2 -translate-y-1/2 bg-cyan-400/20 transition-transform duration-300",
          open && "rotate-45",
        )}
      />
      <div
        className="absolute left-1/2 top-1/2 h-6 w-6 rounded-full border border-cyan-400/40 transition-all duration-300"
        style={{
          transform: `translate(-50%, -50%) scale(${open ? 0.9 : 1})`,
          background: open
            ? "radial-gradient(circle at 35% 35%, #ffffff 0%, #38bdf8 40%, #0369a1 100%)"
            : "radial-gradient(circle at 35% 35%, #e2e8f0 0%, #64748b 40%, #1e293b 100%)",
          boxShadow: open ? "0 0 14px #22d3ee" : "none",
        }}
      />
      <div
        className={cn(
          "absolute top-[12%] h-3 w-1 -translate-x-1/2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] transition-all duration-300",
          open ? "opacity-100" : "opacity-40",
        )}
      />
    </div>
  );
}

const DRAG_CLICK_THRESHOLD_PX = 8;

export function RadialMenu() {
  const [open, setOpen] = useState(false);
  const itemAngles = useMemo(
    () => radialItemAngles(MENU_ITEMS.length),
    [],
  );
  const dragRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    moved: false,
    suppressNextClick: false,
  });

  const onPointerDownCapture = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    dragRef.current.active = true;
    dragRef.current.moved = false;
    dragRef.current.startX = event.clientX;
    dragRef.current.startY = event.clientY;
  };

  const onPointerMoveCapture = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    const dx = event.clientX - dragRef.current.startX;
    const dy = event.clientY - dragRef.current.startY;
    if (Math.hypot(dx, dy) > DRAG_CLICK_THRESHOLD_PX) {
      dragRef.current.moved = true;
    }
  };

  const onPointerUpCapture = () => {
    if (dragRef.current.moved) {
      dragRef.current.suppressNextClick = true;
    }
    dragRef.current.active = false;
  };

  const suppressIfDragging = (event: React.MouseEvent<HTMLDivElement>) => {
    if (dragRef.current.suppressNextClick) {
      event.preventDefault();
      event.stopPropagation();
      dragRef.current.suppressNextClick = false;
      return true;
    }
    return false;
  };

  const toggleOpen = () => setOpen((value) => !value);

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className="relative inline-flex items-center justify-center overflow-visible"
        onPointerDownCapture={onPointerDownCapture}
        onPointerMoveCapture={onPointerMoveCapture}
        onPointerUpCapture={onPointerUpCapture}
        onClickCapture={suppressIfDragging}
      >
        {open ? (
          <button
            type="button"
            aria-label="Close radial menu"
            className="fixed inset-0 z-[100] cursor-default border-0 bg-transparent p-0"
            onClick={() => setOpen(false)}
          />
        ) : null}

        <ul className="relative m-0 list-none p-0">
          {MENU_ITEMS.map((item, index) => {
            const angle = itemAngles[index] ?? START_ANGLE;
            return (
              <li
                key={item.label}
                className={cn(
                  "absolute left-1/2 top-1/2 z-[102] transition-all duration-500",
                  open
                    ? "visible opacity-100"
                    : "invisible opacity-0",
                )}
                style={{
                  transform: open
                    ? `translate(-50%, -50%) rotate(${angle}deg) translate(${RADIUS_REM}rem) rotate(${-angle}deg)`
                    : "translate(-50%, -50%)",
                }}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => console.log("selected:", item.label)}
                      className="transition-transform duration-200 hover:scale-105 active:scale-95"
                    >
                      <TwoPositionFace label={item.icon} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">{item.tooltip}</TooltipContent>
                </Tooltip>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          aria-pressed={open}
          aria-expanded={open}
          onClick={toggleOpen}
          className="relative z-[101] grid h-20 w-20 place-items-center rounded-full border border-cyan-400/20 bg-slate-950/40 text-cyan-100 outline-none backdrop-blur-md transition-all duration-200 hover:border-cyan-400/40 hover:bg-slate-900/60 active:scale-95"
        >
          <DialFace open={open} />
        </button>
      </div>
    </TooltipProvider>
  );
}
