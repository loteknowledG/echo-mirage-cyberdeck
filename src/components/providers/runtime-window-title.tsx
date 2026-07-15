"use client";

import { useEffect } from "react";
import { resolveSurveyCyberdeckShell } from "@/lib/electron/desktop-install.client";

const APP_TITLE = "Echo Mirage Cyberdeck";

function resolveEnvironmentLabel(hostname: string): "Local" | "Vercel" | "Hosted" {
  const host = hostname.trim().toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    return "Local";
  }
  if (host === "vercel.app" || host.endsWith(".vercel.app")) {
    return "Vercel";
  }
  return "Hosted";
}

export function RuntimeWindowTitle() {
  useEffect(() => {
    const shell = resolveSurveyCyberdeckShell();
    const runtimeLabel = shell.kind === "desktop" ? "Electron" : shell.label;
    const environmentLabel = resolveEnvironmentLabel(window.location.hostname);
    const title = `${APP_TITLE} — ${runtimeLabel} · ${environmentLabel}`;
    const applyTitle = () => {
      if (document.title !== title) document.title = title;
    };

    applyTitle();
    const observer = new MutationObserver(applyTitle);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
