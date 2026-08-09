"use client";

import { useEffect } from "react";
import {
  buildRuntimeFaviconHref,
  isWindowsClient,
  resolveCyberdeckRuntimeBadge,
} from "@/lib/cyberdeck/cyberdeck-runtime-badge.client";
import { resolveSurveyCyberdeckShell } from "@/lib/electron/desktop-install.client";

const APP_TITLE = "Echo Mirage Cyberdeck";

function upsertLink(rel: string, href: string, type?: string) {
  const selector = type
    ? `link[rel="${rel}"][type="${type}"]`
    : `link[rel="${rel}"]:not([type])`;
  let link = document.head.querySelector<HTMLLinkElement>(selector);
  if (!link) {
    link = document.createElement("link");
    link.rel = rel;
    if (type) link.type = type;
    document.head.appendChild(link);
  }
  link.href = href;
}

export function RuntimeShellIndicator() {
  useEffect(() => {
    const badge = resolveCyberdeckRuntimeBadge();
    const shell = resolveSurveyCyberdeckShell();
    const runtimeLabel = shell.kind === "desktop" ? "Electron" : shell.label;
    const title = `${APP_TITLE} — ${runtimeLabel} · ${badge.titleSuffix}`;
    const faviconHref = buildRuntimeFaviconHref(badge);

    document.documentElement.dataset.echoMirageShell = badge.id;
    document.documentElement.dataset.echoMirageRuntime = shell.kind;
    if (isWindowsClient()) {
      document.documentElement.dataset.os = "win";
    }

    const applyTitle = () => {
      if (document.title !== title) document.title = title;
    };

    applyTitle();
    upsertLink("icon", faviconHref, "image/svg+xml");
    upsertLink("apple-touch-icon", "/icon-192.png");

    const observer = new MutationObserver(applyTitle);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
