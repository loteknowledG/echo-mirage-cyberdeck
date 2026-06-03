"use client";

import { useState, type RefObject } from "react";
import { motion } from "motion/react";
import { CyberdeckRollingPicker } from "@/components/cyberdeck/cyberdeck-rolling-picker";
import type { CyberdeckRollingPickerItem } from "@/components/cyberdeck/cyberdeck-rolling-picker";

type PowerfistRectControllerProps = {
  constraintsRef: RefObject<HTMLElement | null>;
  disabled?: boolean;
  paneRollerItems: CyberdeckRollingPickerItem[];
  targetPane: string;
  onTargetPaneChange: (next: string) => void;
  onNavigateCard: (delta: number) => void;
  onDeckUp: () => void;
  onDeckDown: () => void;
};

/**
 * Floating NES-proportion rectangle controller (compare with floating d-pad).
 * Drag is clamped to the Powerfist pane via Motion dragConstraints.
 * @see https://examples.motion.dev/react/drag-constraints
 */
export function PowerfistRectController({
  constraintsRef,
  disabled = false,
  paneRollerItems,
  targetPane,
  onTargetPaneChange,
  onNavigateCard,
  onDeckUp,
  onDeckDown,
}: PowerfistRectControllerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const controlsDisabled = disabled || isDragging;

  return (
    <section className="powerfistRectLayer" aria-label="Rectangle controller">
      <motion.div
        className="powerfistRectDrag"
        drag
        dragConstraints={constraintsRef}
        dragElastic={0.2}
        dragMomentum
        onDragStart={() => setIsDragging(true)}
        onDragEnd={() => setIsDragging(false)}
      >
        <div className="powerfistRectController">
          <div className="powerfistRectController__dpad">
            <span className="powerfistRectController__zoneLabel">DPAD</span>
            <button
              type="button"
              className="powerfistRectBtn powerfistRectBtn--up"
              aria-label="Rectangle: move deck up"
              disabled={controlsDisabled}
              onClick={onDeckUp}
            >
              ↑
            </button>
            <button
              type="button"
              className="powerfistRectBtn powerfistRectBtn--left"
              aria-label="Rectangle: move cards left"
              disabled={controlsDisabled}
              onClick={() => onNavigateCard(1)}
            >
              ←
            </button>
            <button
              type="button"
              className="powerfistRectBtn powerfistRectBtn--right"
              aria-label="Rectangle: move cards right"
              disabled={controlsDisabled}
              onClick={() => onNavigateCard(-1)}
            >
              →
            </button>
            <button
              type="button"
              className="powerfistRectBtn powerfistRectBtn--down"
              aria-label="Rectangle: move deck down"
              disabled={controlsDisabled}
              onClick={onDeckDown}
            >
              ↓
            </button>
          </div>

          <div className="powerfistRectController__center">
            <span className="powerfistRectController__zoneLabel">TARGET</span>
            <CyberdeckRollingPicker
              items={paneRollerItems}
              value={targetPane}
              onChange={onTargetPaneChange}
              ariaLabel="Rectangle controller target pane"
              viewportClassName="powerfistRectController__roller"
              alwaysShowLabel
              showTextWhileScrolling
              loop
            />
          </div>

          <div className="powerfistRectController__face">
            <span className="powerfistRectController__zoneLabel">FACE</span>
            <button
              type="button"
              className="powerfistRectBtn powerfistRectBtn--round powerfistRectBtn--b"
            aria-label="Rectangle: B — previous deck"
            disabled={controlsDisabled}
            onClick={onDeckUp}
            >
              B
            </button>
            <button
              type="button"
              className="powerfistRectBtn powerfistRectBtn--round powerfistRectBtn--a"
            aria-label="Rectangle: A — next deck"
            disabled={controlsDisabled}
            onClick={onDeckDown}
            >
              A
            </button>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
