"use client";

import type { ReactNode } from "react";

import {
  parseMuthurUplinkProgressPhase,
  type MuthurUplinkProgressKind,
} from "@/lib/muthur-core/muthur-progress-phase";

type MuthurUplinkProgressProps = {
  progressText: string;
  renderText?: (text: string) => ReactNode;
};

function phaseGlyphClass(kind: MuthurUplinkProgressKind): string {
  if (kind === "transmit") return "muthur-uplink-progress-glyph muthur-uplink-progress-glyph--transmit";
  if (kind === "thinking") return "muthur-uplink-progress-glyph muthur-uplink-progress-glyph--thinking";
  return "muthur-uplink-progress-glyph";
}

/** Live uplink progress — clearly not a final MUTHUR reply. */
export function MuthurUplinkProgress({ progressText, renderText }: MuthurUplinkProgressProps) {
  const trimmed = progressText.trim();
  if (!trimmed.startsWith("⏳ MUTHUR")) return null;

  const phase = parseMuthurUplinkProgressPhase(trimmed);
  const detail = phase.detail.replace(/^MUTHUR\s*\/\/\s*/i, "");

  return (
    <div
      data-muthur-progress
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="muthur-uplink-progress nav-row py-2"
    >
      <div className="muthur-uplink-progress-head">
        <span className={phaseGlyphClass(phase.kind)} aria-hidden>
          ◉
        </span>
        <div className="min-w-0 flex-1">
          <p className="muthur-uplink-progress-title">
            MUTHUR // {phase.title}
            <span className="muthur-uplink-progress-ellipsis" aria-hidden>
              …
            </span>
          </p>
          <p className="muthur-uplink-progress-ascii" aria-hidden>
            {phase.ascii}
          </p>
          <p className="muthur-uplink-progress-message">
            {renderText ? renderText(detail) : detail}
          </p>
          <p className="muthur-uplink-progress-hint">Not the final reply — response in progress</p>
        </div>
      </div>
      <div className="panel-loader-bar muthur-uplink-progress-bar" aria-hidden="true" />
    </div>
  );
}
