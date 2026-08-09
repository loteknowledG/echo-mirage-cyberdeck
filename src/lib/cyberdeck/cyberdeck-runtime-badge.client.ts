"use client";

import { isEchoMirageDesktopShell } from "@/lib/electron/desktop-install.client";

export type CyberdeckRuntimeBadgeId = "electron" | "vercel" | "local" | "hosted";

export type CyberdeckRuntimeBadge = {
  id: CyberdeckRuntimeBadgeId;
  label: string;
  shortLabel: string;
  accent: string;
  titleSuffix: string;
};

function resolveHostname(): string {
  if (typeof window === "undefined") return "";
  return window.location.hostname.trim().toLowerCase();
}

export function resolveCyberdeckRuntimeBadge(): CyberdeckRuntimeBadge {
  if (typeof window === "undefined") {
    return {
      id: "hosted",
      label: "Hosted",
      shortLabel: "H",
      accent: "#fbbf24",
      titleSuffix: "Hosted",
    };
  }

  if (isEchoMirageDesktopShell()) {
    const local =
      resolveHostname() === "localhost" ||
      resolveHostname() === "127.0.0.1" ||
      resolveHostname() === "::1";
    return {
      id: "electron",
      label: local ? "Electron · Local" : "Electron",
      shortLabel: "E",
      accent: "#38bdf8",
      titleSuffix: local ? "Electron · Local" : "Electron",
    };
  }

  const host = resolveHostname();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    return {
      id: "local",
      label: "Local",
      shortLabel: "L",
      accent: "#34d399",
      titleSuffix: "Local",
    };
  }

  if (host === "vercel.app" || host.endsWith(".vercel.app")) {
    return {
      id: "vercel",
      label: "Vercel",
      shortLabel: "V",
      accent: "#a78bfa",
      titleSuffix: "Vercel",
    };
  }

  return {
    id: "hosted",
    label: "Hosted",
    shortLabel: "H",
    accent: "#fbbf24",
    titleSuffix: "Hosted",
  };
}

export function buildRuntimeFaviconSvg(badge: CyberdeckRuntimeBadge): string {
  const { shortLabel, accent } = badge;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Echo Mirage ${badge.label}">
  <rect width="64" height="64" rx="14" fill="#050505"/>
  <rect x="5" y="5" width="54" height="54" rx="11" fill="none" stroke="#34d399" stroke-width="3"/>
  <text x="32" y="39" text-anchor="middle" font-family="ui-monospace,Consolas,monospace" font-size="20" fill="#34d399">EM</text>
  <circle cx="50" cy="14" r="12" fill="${accent}"/>
  <text x="50" y="18" text-anchor="middle" font-family="ui-monospace,Consolas,monospace" font-size="11" font-weight="700" fill="#050505">${shortLabel}</text>
</svg>`;
}

export function buildRuntimeFaviconHref(badge: CyberdeckRuntimeBadge): string {
  const svg = buildRuntimeFaviconSvg(badge);
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function isWindowsClient(): boolean {
  if (typeof navigator === "undefined") return false;
  return /windows/i.test(navigator.userAgent);
}
