"use client";

import { useCallback } from "react";
import type { RefObject } from "react";
import {
  OPERATOR_BROWSER_HOME_URL,
  looksLikeCaptchaBlock,
  normalizeOperatorBrowserUrl,
  type BrowserCommand,
} from "@/lib/browser-intents";

type BrowserControllerArgs = {
  operatorBrowserRef: RefObject<HTMLWebViewElement | null>;
  operatorBrowserUrl: string;
  setOperatorBrowserUrl: (nextUrl: string) => void;
  setOperatorSurfaceMode: (nextMode: "workspace" | "browser") => void;
  setServer: (nextServer: "m" | "s") => void;
  setOperatorBrowserSnapshot: (nextSnapshot: string) => void;
};

export function useBrowserController({
  operatorBrowserRef,
  operatorBrowserUrl,
  setOperatorBrowserUrl,
  setOperatorSurfaceMode,
  setServer,
  setOperatorBrowserSnapshot,
}: BrowserControllerArgs) {
  const getBrowserBridge = useCallback(() => {
    if (typeof window === "undefined") return null;
    return window.echoMirageBrowser || null;
  }, []);

  const applyBrowserSnapshot = useCallback(
    (snapshot: EchoMirageBrowserSnapshot, fallbackUrl: string) => {
      if (!snapshot.ok && snapshot.error) {
        setOperatorBrowserSnapshot(`URL: ${fallbackUrl}\n\nERROR: ${snapshot.error}`);
        return;
      }

      const url = (snapshot.url || fallbackUrl || "").trim();
      const title = (snapshot.title || "").trim();
      const text = (snapshot.text || "").trim();
      const parts = [
        url ? `URL: ${url}` : null,
        title ? `TITLE: ${title}` : null,
        text ? `PAGE TEXT:\n${text.slice(0, 6000)}` : null,
      ].filter(Boolean);
      setOperatorBrowserSnapshot(parts.join("\n\n") || `URL: ${fallbackUrl}`);
    },
    [setOperatorBrowserSnapshot],
  );

  const syncBrowserEngineToUrl = useCallback(
    async (nextUrl: string) => {
      const normalizedUrl = normalizeOperatorBrowserUrl(nextUrl);
      const bridge = getBrowserBridge();

      if (!bridge) {
        const fallback = `URL: ${normalizedUrl}`;
        setOperatorBrowserSnapshot(fallback);
        return fallback;
      }

      try {
        const snapshot = await bridge.navigate(normalizedUrl);
        applyBrowserSnapshot(snapshot, normalizedUrl);
        const url = (snapshot.url || normalizedUrl || "").trim();
        const title = (snapshot.title || "").trim();
        const text = (snapshot.text || "").trim();
        return [
          url ? `URL: ${url}` : null,
          title ? `TITLE: ${title}` : null,
          text ? `PAGE TEXT:\n${text.slice(0, 6000)}` : null,
        ]
          .filter(Boolean)
          .join("\n\n") || `URL: ${normalizedUrl}`;
      } catch {
        const fallback = `URL: ${normalizedUrl}`;
        setOperatorBrowserSnapshot(fallback);
        return fallback;
      }
    },
    [applyBrowserSnapshot, getBrowserBridge, setOperatorBrowserSnapshot],
  );

  const openOperatorBrowser = useCallback(
    async (nextUrl?: string) => {
      const normalizedUrl = normalizeOperatorBrowserUrl(nextUrl || OPERATOR_BROWSER_HOME_URL);

      setServer("m");
      setOperatorSurfaceMode("browser");
      setOperatorBrowserUrl(normalizedUrl);
      return await syncBrowserEngineToUrl(normalizedUrl);
    },
    [setOperatorBrowserUrl, setOperatorSurfaceMode, setServer, syncBrowserEngineToUrl],
  );

  const executeVisibleBrowserScript = useCallback(async (script: string) => {
    const view = operatorBrowserRef.current;
    if (!view) return null;
    try {
      return await view.executeJavaScript(script);
    } catch {
      return null;
    }
  }, [operatorBrowserRef]);

  const performBrowserCommand = useCallback(
    async (command: BrowserCommand) => {
      const bridge = getBrowserBridge();
      const view = operatorBrowserRef.current;

      const readVisibleSnapshot = async () => {
        const url = view?.getURL?.() || operatorBrowserUrl;
        const title = view?.getTitle?.() || "";
        let text = "";
        try {
          const bodyText = await executeVisibleBrowserScript(
            "document && document.body ? String(document.body.innerText || document.body.textContent || '') : ''",
          );
          text = typeof bodyText === "string" ? bodyText.trim() : "";
        } catch {
          text = "";
        }
        return {
          ok: true,
          url,
          title,
          text,
        } satisfies EchoMirageBrowserSnapshot;
      };

      if (command.kind === "goto") {
        const nextUrl = normalizeOperatorBrowserUrl(command.url);
        const nextSnapshot = await openOperatorBrowser(nextUrl);
        if (looksLikeCaptchaBlock(nextSnapshot || nextUrl)) {
          return `${nextSnapshot || `URL: ${nextUrl}`}\n\nCAPTCHA_BLOCKED // MANUAL_COMPLETION_REQUIRED`;
        }
        return nextSnapshot || `URL: ${nextUrl}`;
      }

      const selectorJson = (selector: string) => JSON.stringify(selector.trim());
      const valueJson = (value: string) => JSON.stringify(value);

      const runDualAction = async (script: string, bridgeAction?: Promise<EchoMirageBrowserSnapshot>) => {
        await executeVisibleBrowserScript(script);
        const snapshot = bridgeAction ? await bridgeAction.catch(() => null) : null;
        if (snapshot) {
          applyBrowserSnapshot(snapshot, operatorBrowserUrl);
          if (snapshot.url && snapshot.url !== operatorBrowserUrl) {
            setOperatorBrowserUrl(snapshot.url);
          }
          return [
            snapshot.url ? `URL: ${snapshot.url}` : null,
            snapshot.title ? `TITLE: ${snapshot.title}` : null,
            snapshot.text ? `PAGE TEXT:\n${snapshot.text.slice(0, 6000)}` : null,
          ]
            .filter(Boolean)
            .join("\n\n") || `URL: ${operatorBrowserUrl}`;
        }

        const visibleSnapshot = await readVisibleSnapshot();
        applyBrowserSnapshot(visibleSnapshot, operatorBrowserUrl);
        if (visibleSnapshot.url && visibleSnapshot.url !== operatorBrowserUrl) {
          setOperatorBrowserUrl(visibleSnapshot.url);
        }
        return [
          visibleSnapshot.url ? `URL: ${visibleSnapshot.url}` : null,
          visibleSnapshot.title ? `TITLE: ${visibleSnapshot.title}` : null,
          visibleSnapshot.text ? `PAGE TEXT:\n${visibleSnapshot.text.slice(0, 6000)}` : null,
        ]
          .filter(Boolean)
          .join("\n\n") || `URL: ${operatorBrowserUrl}`;
      };

      if (command.kind === "click") {
        const selector = command.selector.trim();
        const script = `
          (() => {
            const selector = ${selectorJson(selector)};
            const el = document.querySelector(selector);
            if (!el) return { ok: false, error: \`Selector not found: \${selector}\` };
            if (typeof el.click === "function") el.click();
            return { ok: true };
          })()
        `;
        return await runDualAction(script, bridge?.click(selector));
      }

      if (command.kind === "type") {
        const selector = command.selector.trim();
        const value = command.value;
        const script = `
          (() => {
            const selector = ${selectorJson(selector)};
            const value = ${valueJson(value)};
            const el = document.querySelector(selector);
            if (!el) return { ok: false, error: \`Selector not found: \${selector}\` };
            const isInput = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
            if (isInput) {
              const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
              const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
              if (descriptor && descriptor.set) descriptor.set.call(el, value);
              else el.value = value;
              el.dispatchEvent(new Event("input", { bubbles: true }));
              el.dispatchEvent(new Event("change", { bubbles: true }));
              return { ok: true };
            }
            if (el.isContentEditable) {
              el.focus();
              el.innerText = value;
              el.dispatchEvent(new Event("input", { bubbles: true }));
              return { ok: true };
            }
            return { ok: false, error: \`Selector is not editable: \${selector}\` };
          })()
        `;
        return await runDualAction(script, bridge?.type(selector, value));
      }

      if (command.kind === "submit") {
        const selector = command.selector.trim();
        const script = `
          (() => {
            const selector = ${selectorJson(selector)};
            const el = document.querySelector(selector);
            if (!el) return { ok: false, error: \`Selector not found: \${selector}\` };
            const form = el.tagName === "FORM" ? el : el.closest("form");
            if (form) {
              if (typeof form.requestSubmit === "function") form.requestSubmit();
              else if (typeof form.submit === "function") form.submit();
              return { ok: true };
            }
            if (typeof el.click === "function") {
              el.click();
              return { ok: true };
            }
            return { ok: false, error: \`Selector has no form or click handler: \${selector}\` };
          })()
        `;
        return await runDualAction(script, bridge?.submit(selector));
      }

      if (command.kind === "back") {
        const visible = view && view.canGoBack() ? view.goBack() : null;
        const snapshot = bridge ? await bridge.back().catch(() => null) : null;
        if (snapshot) {
          applyBrowserSnapshot(snapshot, operatorBrowserUrl);
          if (snapshot.url) {
            setOperatorBrowserUrl(snapshot.url);
          }
          return `URL: ${snapshot.url || operatorBrowserUrl}`;
        }
        await visible;
        const visibleSnapshot = await readVisibleSnapshot();
        applyBrowserSnapshot(visibleSnapshot, operatorBrowserUrl);
        return visibleSnapshot.url ? `URL: ${visibleSnapshot.url}` : `URL: ${operatorBrowserUrl}`;
      }

      if (command.kind === "forward") {
        const visible = view && view.canGoForward() ? view.goForward() : null;
        const snapshot = bridge ? await bridge.forward().catch(() => null) : null;
        if (snapshot) {
          applyBrowserSnapshot(snapshot, operatorBrowserUrl);
          if (snapshot.url) {
            setOperatorBrowserUrl(snapshot.url);
          }
          return `URL: ${snapshot.url || operatorBrowserUrl}`;
        }
        await visible;
        const visibleSnapshot = await readVisibleSnapshot();
        applyBrowserSnapshot(visibleSnapshot, operatorBrowserUrl);
        return visibleSnapshot.url ? `URL: ${visibleSnapshot.url}` : `URL: ${operatorBrowserUrl}`;
      }

      if (command.kind === "reload") {
        const visible = view?.reload?.();
        const snapshot = bridge ? await bridge.reload().catch(() => null) : null;
        if (snapshot) {
          applyBrowserSnapshot(snapshot, operatorBrowserUrl);
          if (snapshot.url) {
            setOperatorBrowserUrl(snapshot.url);
          }
          return `URL: ${snapshot.url || operatorBrowserUrl}`;
        }
        await visible;
        const visibleSnapshot = await readVisibleSnapshot();
        applyBrowserSnapshot(visibleSnapshot, operatorBrowserUrl);
        return visibleSnapshot.url ? `URL: ${visibleSnapshot.url}` : `URL: ${operatorBrowserUrl}`;
      }

      const visibleSnapshot = await readVisibleSnapshot();
      applyBrowserSnapshot(visibleSnapshot, operatorBrowserUrl);
      return visibleSnapshot.url ? `URL: ${visibleSnapshot.url}` : `URL: ${operatorBrowserUrl}`;
    },
    [
      applyBrowserSnapshot,
      executeVisibleBrowserScript,
      getBrowserBridge,
      openOperatorBrowser,
      operatorBrowserRef,
      operatorBrowserUrl,
      setOperatorBrowserUrl,
    ],
  );

  const captureOperatorBrowserSnapshot = useCallback(async () => {
    const bridge = getBrowserBridge();
    if (!bridge) {
      const view = operatorBrowserRef.current;
      if (!view) return;

      try {
        const [title, bodyText] = await Promise.all([
          Promise.resolve(typeof view.getTitle === "function" ? view.getTitle() : "").catch(() => ""),
          view.executeJavaScript(
            "document && document.body ? String(document.body.innerText || document.body.textContent || '') : ''",
          ),
        ]);

        const url = typeof view.getURL === "function" ? view.getURL() : operatorBrowserUrl;
        const text = typeof bodyText === "string" ? bodyText.trim() : "";
        const parts = [
          url ? `URL: ${url}` : null,
          title ? `TITLE: ${title.trim()}` : null,
          text ? `PAGE TEXT:\n${text.slice(0, 6000)}` : null,
        ].filter(Boolean);
        setOperatorBrowserSnapshot(parts.join("\n\n"));
      } catch {
        setOperatorBrowserSnapshot(operatorBrowserUrl);
      }
      return;
    }

    try {
      const snapshot = await bridge.snapshot();
      applyBrowserSnapshot(snapshot, operatorBrowserUrl);
      const url = (snapshot.url || operatorBrowserUrl || "").trim();
      const title = (snapshot.title || "").trim();
      const text = (snapshot.text || "").trim();
      return [
        url ? `URL: ${url}` : null,
        title ? `TITLE: ${title}` : null,
        text ? `PAGE TEXT:\n${text.slice(0, 6000)}` : null,
      ]
        .filter(Boolean)
        .join("\n\n") || `URL: ${operatorBrowserUrl}`;
    } catch {
      setOperatorBrowserSnapshot(operatorBrowserUrl);
      return `URL: ${operatorBrowserUrl}`;
    }
  }, [applyBrowserSnapshot, getBrowserBridge, operatorBrowserRef, operatorBrowserUrl, setOperatorBrowserSnapshot]);

  return {
    captureOperatorBrowserSnapshot,
    openOperatorBrowser,
    performBrowserCommand,
  };
}
