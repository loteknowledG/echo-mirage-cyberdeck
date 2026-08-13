"use client";

import {
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export const MUTHUR_COMPOSER_HEIGHT_STORAGE_KEY = "echo-mirage-muthur-composer-height-v1";
export const MUTHUR_COMPOSER_DEFAULT_HEIGHT_PX = 148;
export const MUTHUR_COMPOSER_MIN_HEIGHT_PX = 116;
export const MUTHUR_COMPOSER_MAX_HEIGHT_PX = 640;
const MIN_CHAT_BODY_PX = 96;
const RESIZER_PX = 12;

function clampMuthurComposerHeight(height: number, panelMax: number): number {
  const max = Math.max(
    MUTHUR_COMPOSER_MIN_HEIGHT_PX,
    Math.min(MUTHUR_COMPOSER_MAX_HEIGHT_PX, Math.floor(panelMax)),
  );
  return Math.min(max, Math.max(MUTHUR_COMPOSER_MIN_HEIGHT_PX, Math.round(height)));
}

function readStoredComposerHeight(): number {
  if (typeof window === "undefined") return MUTHUR_COMPOSER_DEFAULT_HEIGHT_PX;
  try {
    const raw = window.localStorage.getItem(MUTHUR_COMPOSER_HEIGHT_STORAGE_KEY);
    const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
    if (Number.isFinite(parsed)) return parsed;
  } catch {
    /* ignore */
  }
  return MUTHUR_COMPOSER_DEFAULT_HEIGHT_PX;
}

function persistComposerHeight(height: number) {
  try {
    window.localStorage.setItem(MUTHUR_COMPOSER_HEIGHT_STORAGE_KEY, String(height));
  } catch {
    /* ignore */
  }
}

export function useMuthurComposerResize() {
  const columnRef = useRef<HTMLDivElement | null>(null);
  const footerRef = useRef<HTMLElement | null>(null);
  const [composerHeight, setComposerHeight] = useState(MUTHUR_COMPOSER_DEFAULT_HEIGHT_PX);
  const [panelMax, setPanelMax] = useState(MUTHUR_COMPOSER_MAX_HEIGHT_PX);

  const measurePanelMax = useCallback(() => {
    const column = columnRef.current;
    if (!column) return MUTHUR_COMPOSER_MAX_HEIGHT_PX;
    const header = column.querySelector<HTMLElement>(":scope > [data-muthur-column-header]");
    const headerHeight = header?.getBoundingClientRect().height ?? 0;
    return Math.max(
      MUTHUR_COMPOSER_MIN_HEIGHT_PX,
      Math.floor(column.getBoundingClientRect().height - headerHeight - MIN_CHAT_BODY_PX - RESIZER_PX),
    );
  }, []);

  const updateComposerHeight = useCallback(
    (height: number) => {
      const next = clampMuthurComposerHeight(height, measurePanelMax());
      setComposerHeight(next);
      persistComposerHeight(next);
    },
    [measurePanelMax],
  );

  useEffect(() => {
    const column = columnRef.current;
    if (!column) return;

    const applyPanelBounds = () => {
      const max = measurePanelMax();
      setPanelMax(max);
      setComposerHeight((current) => {
        const next = clampMuthurComposerHeight(current, max);
        if (next !== current) persistComposerHeight(next);
        return next;
      });
    };

    setComposerHeight(clampMuthurComposerHeight(readStoredComposerHeight(), measurePanelMax()));
    applyPanelBounds();
    const observer = new ResizeObserver(applyPanelBounds);
    observer.observe(column);
    return () => observer.disconnect();
  }, [measurePanelMax]);

  const startComposerResizeDrag = useCallback(
    (clientY: number, eventType: "mouse" | "pointer") => {
      const footer = footerRef.current;
      const bottom = footer?.getBoundingClientRect().bottom ?? window.innerHeight;
      updateComposerHeight(bottom - clientY);

      if (eventType === "mouse") {
        const handleMouseMove = (moveEvent: globalThis.MouseEvent) => {
          updateComposerHeight(bottom - moveEvent.clientY);
        };
        const handleMouseUp = () => {
          window.removeEventListener("mousemove", handleMouseMove);
          window.removeEventListener("mouseup", handleMouseUp);
        };
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp, { once: true });
        return;
      }

      const handlePointerMove = (moveEvent: globalThis.PointerEvent) => {
        updateComposerHeight(bottom - moveEvent.clientY);
      };
      const handlePointerUp = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerUp);
      };
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp, { once: true });
      window.addEventListener("pointercancel", handlePointerUp, { once: true });
    },
    [updateComposerHeight],
  );

  const handleComposerResizePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      startComposerResizeDrag(event.clientY, "pointer");
    },
    [startComposerResizeDrag],
  );

  const handleComposerResizeMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      startComposerResizeDrag(event.clientY, "mouse");
    },
    [startComposerResizeDrag],
  );

  const handleComposerResizeKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const step = event.shiftKey ? 32 : 12;
      if (event.key === "ArrowUp") {
        event.preventDefault();
        updateComposerHeight(composerHeight + step);
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        updateComposerHeight(composerHeight - step);
        return;
      }
      if (event.key === "Home") {
        event.preventDefault();
        updateComposerHeight(MUTHUR_COMPOSER_MIN_HEIGHT_PX);
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        updateComposerHeight(panelMax);
        return;
      }
    },
    [composerHeight, panelMax, updateComposerHeight],
  );

  const assignColumnNode = useCallback((node: HTMLDivElement | null) => {
    columnRef.current = node;
  }, []);

  return {
    assignColumnNode,
    footerRef,
    composerHeight,
    panelMax,
    handleComposerResizePointerDown,
    handleComposerResizeMouseDown,
    handleComposerResizeKeyDown,
  };
}
