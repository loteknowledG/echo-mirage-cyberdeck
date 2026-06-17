"use client";

import type { ReactNode } from "react";

import {
  getMuthurNotifyAsciiClass,
  getMuthurNotifyAsciiLine,
  getMuthurNotifyBurstClass,
  getMuthurNotifyLiveClass,
  getMuthurNotifySettledClass,
  isMuthurNotifyMessage,
} from "@/lib/muthur-notify-style";

type MuthurNotifyLineProps = {
  text: string;
  live?: boolean;
  renderText?: (text: string) => ReactNode;
};

/** MUTHUR uplink / operator notification — belongs in chat, not under the composer. */
export function MuthurNotifyLine({ text, live = false, renderText }: MuthurNotifyLineProps) {
  const trimmed = text.trim();
  if (!trimmed || !isMuthurNotifyMessage(trimmed)) return null;

  const ascii = getMuthurNotifyAsciiLine(trimmed);
  const burstClass = live ? null : getMuthurNotifyBurstClass(trimmed);
  const liveClass = live ? getMuthurNotifyLiveClass(trimmed) : null;
  const settledClass =
    !live && !burstClass && isMuthurNotifyMessage(trimmed) ? getMuthurNotifySettledClass(trimmed) : null;
  const displayText = trimmed.replace(/^⏳\s*/, "");

  return (
    <div data-muthur-notify className="nav-row py-1 font-mono text-[10px] leading-snug">
      {ascii ? <span className={getMuthurNotifyAsciiClass(trimmed)}>{ascii}</span> : null}
      <div className={liveClass ?? burstClass ?? settledClass ?? undefined}>
        <span className="whitespace-pre-wrap">
          {renderText ? renderText(displayText) : displayText}
        </span>
      </div>
    </div>
  );
}
