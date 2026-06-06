"use client";

import { useEffect, useState } from "react";
import { CyberdeckActionButton } from "@/components/cyberdeck/cyberdeck-control-button";
import { emitSignal } from "@/lib/cyberdeck/signal-router";

const BOOT_KEY = "echo-mirage-boot-completed-v1";

const BOOT_LINES = [
  "> ECHO MIRAGE :: COLD START",
  "> REACTOR :: ONLINE",
  "> RAIL :: BUS NOMINAL",
  "> OPERATORS :: HANDSHAKE",
  "> CHATGPT // LEAD :: ONLINE",
  "> CURSOR // DEV :: ONLINE",
  "> CODEX // TEST :: ONLINE",
  "> SAMUS-MANUS // MEMORY :: ONLINE",
  "> DECK :: READY",
];

export function CyberdeckBootSequence() {
  const [visibleCount, setVisibleCount] = useState(0);
  const [rendered, setRendered] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.localStorage === "undefined") return;
    if (window.localStorage.getItem(BOOT_KEY) === "1") return;
    setRendered(true);
    setVisibleCount(0);
    const lineTimer = window.setInterval(() => {
      setVisibleCount((prev) => {
        const next = prev + 1;
        const line = BOOT_LINES[next - 1];
        if (line) {
          const parts = line.replace(/^>\s*/, "").split("::").map((part) => part.trim());
          emitSignal({
            source: "system",
            type: "boot_line",
            payload: {
              actor: parts[0] || "BOOT",
              action: (parts[1] || "progress").toLowerCase(),
              result: parts[2] || "OK",
              line,
            },
            severity: "info",
          });
        }
        return Math.min(next, BOOT_LINES.length);
      });
    }, 260);
    const finishTimer = window.setTimeout(() => {
      setFadingOut(true);
      window.localStorage.setItem(BOOT_KEY, "1");
      window.setTimeout(() => setRendered(false), 360);
    }, 2800);
    return () => {
      window.clearInterval(lineTimer);
      window.clearTimeout(finishTimer);
    };
  }, []);

  if (!rendered) return null;

  return (
    <div
      className={`fixed inset-0 z-[110] bg-black px-4 py-6 font-mono text-[11px] text-emerald-300 transition-opacity duration-300 ${fadingOut ? "opacity-0" : "opacity-100"}`}
    >
      <CyberdeckActionButton
        variant="neutral"
        className="absolute right-3 top-2"
        onClick={() => {
          if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
            window.localStorage.setItem(BOOT_KEY, "1");
          }
          setFadingOut(true);
          window.setTimeout(() => setRendered(false), 220);
        }}
      >
        Skip
      </CyberdeckActionButton>
      <div className="mx-auto mt-12 max-w-2xl space-y-1 border border-[#1b1b1b] bg-black/90 p-4">
        {BOOT_LINES.slice(0, visibleCount).map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>
    </div>
  );
}
