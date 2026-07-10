"use client";

import { useEffect, useState } from "react";
import {
  useSurveyExtensionPageContextStatus,
  type SurveyExtensionPageContextStatus,
} from "@/lib/cyberdeck/survey-extension-page-context.client";

const TOAST_VISIBLE_MS = 8000;

function formatReceiptTime(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "";
  }
}

function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

export function SurveyExtensionReceiptToast() {
  const status = useSurveyExtensionPageContextStatus();
  const [visible, setVisible] = useState(false);
  const [shown, setShown] = useState<SurveyExtensionPageContextStatus | null>(null);

  useEffect(() => {
    if (!status.deliveredAt || status.deliveryCount === 0) return;
    setShown({ ...status });
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), TOAST_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [status.deliveredAt, status.deliveryCount]);

  if (!visible || !shown?.lastSnapshot) return null;

  const snapshot = shown.lastSnapshot;
  const title = snapshot.title.trim() || "(untitled)";
  const url = truncate(snapshot.url, 72);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-[120] w-[min(92vw,22rem)] animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      <div className="pointer-events-auto rounded border border-emerald-500/60 bg-black/95 px-4 py-3 font-mono text-[11px] text-emerald-100 shadow-[0_0_28px_rgba(62,207,142,0.25)]">
        <p className="text-[9px] uppercase tracking-[0.22em] text-emerald-400">
          Survey Satellite · received #{shown.deliveryCount}
        </p>
        <p className="mt-1 text-[11px] font-semibold text-emerald-200">{truncate(title, 64)}</p>
        <p className="mt-1 break-all text-[9px] text-[#6a9a7a]">{url}</p>
        <p className="mt-2 text-[8px] text-[#4a6b58]">
          {formatReceiptTime(shown.deliveredAt)} · sent to MUTHUR chat
        </p>
      </div>
    </div>
  );
}
