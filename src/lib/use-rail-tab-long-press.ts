import { useCallback, useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

/** Duration before long-press opens menu (ms). */
export const RAIL_TAB_LONG_PRESS_MS = 500;

/** Cancel long-press when pointer moves farther than this from touch start (px). */
export const RAIL_TAB_LONG_PRESS_MOVE_PX = 10;

type OpenMenuFn = (tabId: string, clientX: number, clientY: number) => void;

/**
 * Pointer long-press for rail tabs (touch / pen). Desktop mouse uses context menu only.
 * Call {@link createHandlers} per tab with that tab's id.
 */
export function useRailTabLongPress(options: {
  openMenu: OpenMenuFn;
  getSelectedRailTabId: () => string;
}) {
  const { openMenu, getSelectedRailTabId } = options;

  const timerRef = useRef<number | null>(null);
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const activeTabIdRef = useRef<string | null>(null);
  const suppressClickForTabIdRef = useRef<string | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const releaseCaptureSafe = useCallback((target: HTMLElement, pointerId: number) => {
    try {
      if (target.hasPointerCapture?.(pointerId)) {
        target.releasePointerCapture(pointerId);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const createHandlers = useCallback(
    (tabId: string) => {
      const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
        if (getSelectedRailTabId() !== tabId) return;
        if (event.pointerType === "mouse") return;

        clearTimer();
        suppressClickForTabIdRef.current = null;
        originRef.current = { x: event.clientX, y: event.clientY };
        activeTabIdRef.current = tabId;

        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          /* ignore */
        }

        const start = originRef.current;
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          originRef.current = null;
          if (!start || activeTabIdRef.current !== tabId) return;
          suppressClickForTabIdRef.current = tabId;
          openMenu(tabId, start.x, start.y);
          activeTabIdRef.current = null;
        }, RAIL_TAB_LONG_PRESS_MS);
      };

      const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
        if (timerRef.current == null || originRef.current == null) return;
        const o = originRef.current;
        const dx = event.clientX - o.x;
        const dy = event.clientY - o.y;
        const th = RAIL_TAB_LONG_PRESS_MOVE_PX;
        if (dx * dx + dy * dy > th * th) {
          clearTimer();
          originRef.current = null;
          activeTabIdRef.current = null;
        }
      };

      const onPointerUpLike = (event: ReactPointerEvent<HTMLElement>) => {
        clearTimer();
        originRef.current = null;
        activeTabIdRef.current = null;
        releaseCaptureSafe(event.currentTarget, event.pointerId);

        const suppressTab = suppressClickForTabIdRef.current;
        if (suppressTab === tabId) {
          window.setTimeout(() => {
            if (suppressClickForTabIdRef.current === suppressTab) {
              suppressClickForTabIdRef.current = null;
            }
          }, 350);
        }
      };

      const onPointerLeave = (event: ReactPointerEvent<HTMLElement>) => {
        clearTimer();
        originRef.current = null;
        activeTabIdRef.current = null;
        releaseCaptureSafe(event.currentTarget, event.pointerId);
      };

      return {
        onPointerDown,
        onPointerMove,
        onPointerUp: onPointerUpLike,
        onPointerCancel: onPointerUpLike,
        onPointerLeave,
      };
    },
    [clearTimer, getSelectedRailTabId, openMenu, releaseCaptureSafe],
  );

  const consumeClickIfLongPress = useCallback((tabId: string): boolean => {
    if (suppressClickForTabIdRef.current === tabId) {
      suppressClickForTabIdRef.current = null;
      return true;
    }
    return false;
  }, []);

  const cancelLongPressFromContextMenu = useCallback(() => {
    clearTimer();
    originRef.current = null;
    activeTabIdRef.current = null;
    suppressClickForTabIdRef.current = null;
  }, [clearTimer]);

  return { createHandlers, consumeClickIfLongPress, cancelLongPressFromContextMenu };
}
