"use client";

import { useEffect } from "react";
import PerfectScrollbar from "perfect-scrollbar";

import {
  CYBERDECK_PERFECT_SCROLLBAR_OPTIONS,
  CYBERDECK_PS_ATTR,
  shouldUsePerfectScrollbar,
} from "@/lib/cyberdeck/perfect-scrollbar-options";

/**
 * Auto-inits Perfect Scrollbar (MDB-compatible) on `.custom-scrollbar` scroll regions.
 * Observation only — no keystroke injection; improves drag-thumb / click-rail targets.
 */
export function CyberdeckScrollbarHost() {
  useEffect(() => {
    const instances = new Map<HTMLElement, PerfectScrollbar>();
    const contentObservers = new Map<HTMLElement, MutationObserver>();
    const resizeObservers = new Map<HTMLElement, ResizeObserver>();

    function updateInstance(el: HTMLElement): void {
      instances.get(el)?.update();
    }

    function dispose(el: HTMLElement): void {
      contentObservers.get(el)?.disconnect();
      contentObservers.delete(el);
      resizeObservers.get(el)?.disconnect();
      resizeObservers.delete(el);
      const ps = instances.get(el);
      if (ps) {
        ps.destroy();
        instances.delete(el);
      }
      el.removeAttribute(CYBERDECK_PS_ATTR);
    }

    function init(el: HTMLElement): void {
      if (el.hasAttribute(CYBERDECK_PS_ATTR) || !shouldUsePerfectScrollbar(el)) return;

      if (getComputedStyle(el).position === "static") {
        el.style.position = "relative";
      }

      const ps = new PerfectScrollbar(el, CYBERDECK_PERFECT_SCROLLBAR_OPTIONS);
      el.setAttribute(CYBERDECK_PS_ATTR, "1");
      instances.set(el, ps);

      const contentObserver = new MutationObserver(() => updateInstance(el));
      contentObserver.observe(el, { childList: true, subtree: true, characterData: true });
      contentObservers.set(el, contentObserver);

      const resizeObserver = new ResizeObserver(() => updateInstance(el));
      resizeObserver.observe(el);
      if (el.firstElementChild) resizeObserver.observe(el.firstElementChild);
      resizeObservers.set(el, resizeObserver);
    }

    function scan(root: ParentNode = document.body): void {
      if (!(root instanceof HTMLElement || root instanceof Document)) return;
      const nodes =
        root instanceof Document
          ? root.querySelectorAll(".custom-scrollbar")
          : root.matches?.(".custom-scrollbar")
            ? [root, ...root.querySelectorAll(".custom-scrollbar")]
            : root.querySelectorAll(".custom-scrollbar");

      nodes.forEach((node) => {
        if (node instanceof HTMLElement) init(node);
      });
    }

    scan();

    const domObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) scan(node);
        });
        mutation.removedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            dispose(node);
            node.querySelectorAll(".custom-scrollbar").forEach((child) => {
              if (child instanceof HTMLElement) dispose(child);
            });
          }
        });
      }
    });

    domObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      domObserver.disconnect();
      [...instances.keys()].forEach(dispose);
    };
  }, []);

  return null;
}

export default CyberdeckScrollbarHost;
