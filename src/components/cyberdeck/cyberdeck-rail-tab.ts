const RAIL_TAB_SHADOW_CSS = `
:host {
  display: block;
  box-sizing: border-box;
  width: 48px;
  height: 52px;
  flex-shrink: 0;
  position: relative;
  contain: strict;
  -webkit-touch-callout: none;
  user-select: none;
  -webkit-user-select: none;
}

@media (max-width: 768px) {
  :host {
    scroll-snap-align: start;
  }
}

slot {
  display: block;
  width: 100%;
  height: 100%;
}
`;

let sharedSheet: CSSStyleSheet | null = null;

function getSharedSheet(): CSSStyleSheet {
  if (sharedSheet) return sharedSheet;
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(RAIL_TAB_SHADOW_CSS);
  sharedSheet = sheet;
  return sheet;
}

/**
 * Shadow-DOM shell for a single cyberdeck rail tab. Fixed box + containment so
 * outer layout/Tailwind cannot resize the tab chrome; slotted light-DOM
 * children keep document styles (e.g. `.ascii-btn` in globals.css).
 */
export function registerCyberdeckRailTab(): void {
  if (typeof window === "undefined") return;
  if (typeof HTMLElement === "undefined") return;
  if (typeof customElements === "undefined") return;
  if (customElements.get("cyberdeck-rail-tab")) return;

  class CyberdeckRailTab extends HTMLElement {
    constructor() {
      super();
      const root = this.attachShadow({ mode: "open" });
      try {
        if (typeof CSSStyleSheet !== "undefined") {
          root.adoptedStyleSheets = [getSharedSheet()];
        } else {
          throw new Error("Constructable stylesheets unavailable");
        }
      } catch {
        const style = document.createElement("style");
        style.textContent = RAIL_TAB_SHADOW_CSS;
        root.appendChild(style);
      }
      const slot = document.createElement("slot");
      root.appendChild(slot);
    }
  }

  customElements.define("cyberdeck-rail-tab", CyberdeckRailTab);
}
