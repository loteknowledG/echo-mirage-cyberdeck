import type PerfectScrollbar from "perfect-scrollbar";

/** MDB-compatible Perfect Scrollbar options — drag-thumb + click-rail for easier grabbing. */
export const CYBERDECK_PERFECT_SCROLLBAR_OPTIONS: PerfectScrollbar.Options = {
  handlers: ["click-rail", "drag-thumb", "keyboard", "wheel", "touch"],
  wheelSpeed: 1,
  wheelPropagation: true,
  swipeEasing: true,
  minScrollbarLength: 48,
  maxScrollbarLength: undefined,
  scrollingThreshold: 1000,
  suppressScrollX: false,
  suppressScrollY: false,
  scrollXMarginOffset: 0,
  scrollYMarginOffset: 0,
};

export const CYBERDECK_PS_ATTR = "data-cyberdeck-ps";

export function shouldUsePerfectScrollbar(el: HTMLElement): boolean {
  if (el.hasAttribute("data-native-scrollbar")) return false;
  if (!el.classList.contains("custom-scrollbar")) return false;
  const style = getComputedStyle(el);
  const overflowY = style.overflowY;
  const overflow = style.overflow;
  return (
    overflowY === "auto" ||
    overflowY === "scroll" ||
    overflow === "auto" ||
    overflow === "scroll"
  );
}
