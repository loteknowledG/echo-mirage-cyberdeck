"use client";

import { useCallback, useRef, useState } from "react";
import { Joystick } from "react-joystick-component";
import { CyberdeckRollingPicker } from "@/components/cyberdeck/cyberdeck-rolling-picker";
import type { CyberdeckRollingPickerItem } from "@/components/cyberdeck/cyberdeck-rolling-picker";
import {
  describePowerfistJoystickPath,
  resolvePowerfistJoystickMoves,
  type PowerfistJoystickMove,
} from "./powerfist-joystick-nav";

type JoystickUpdateEvent = {
  type: "move" | "stop" | "start";
  x: number | null;
  y: number | null;
  direction: "FORWARD" | "RIGHT" | "LEFT" | "BACKWARD" | null;
  distance: number | null;
};

type PowerfistJoystickControlsProps = {
  disabled?: boolean;
  paneRollerItems: CyberdeckRollingPickerItem[];
  targetPane: string;
  onTargetPaneChange: (next: string) => void;
  onNavigateCard: (direction: 1 | -1) => void;
  onNavigateDeck: (direction: 1 | -1) => void;
};

function applyJoystickMove(
  move: PowerfistJoystickMove,
  onNavigateCard: (direction: 1 | -1) => void,
  onNavigateDeck: (direction: 1 | -1) => void,
) {
  switch (move) {
    case "card-left":
      onNavigateCard(1);
      return;
    case "card-right":
      onNavigateCard(-1);
      return;
    case "deck-up":
      onNavigateDeck(-1);
      return;
    case "deck-down":
      onNavigateDeck(1);
      return;
    default: {
      const never: never = move;
      return never;
    }
  }
}

export function PowerfistJoystickControls({
  disabled = false,
  paneRollerItems,
  targetPane,
  onTargetPaneChange,
  onNavigateCard,
  onNavigateDeck,
}: PowerfistJoystickControlsProps) {
  const lastGestureRef = useRef<JoystickUpdateEvent | null>(null);
  const [pathHint, setPathHint] = useState("");

  const rememberGesture = useCallback((event: JoystickUpdateEvent) => {
    if (event.x == null || event.y == null || event.distance == null) return;
    lastGestureRef.current = event;
    const moves = resolvePowerfistJoystickMoves(event.x, event.y, event.distance);
    setPathHint(describePowerfistJoystickPath(moves));
  }, []);

  const handleMove = useCallback(
    (event: JoystickUpdateEvent) => {
      if (disabled) return;
      rememberGesture(event);
    },
    [disabled, rememberGesture],
  );

  const handleStop = useCallback(
    (event: JoystickUpdateEvent) => {
      if (disabled) return;
      const sample = lastGestureRef.current ?? event;
      lastGestureRef.current = null;
      const moves = resolvePowerfistJoystickMoves(sample.x, sample.y, sample.distance);
      setPathHint(describePowerfistJoystickPath(moves));
      for (const move of moves) {
        applyJoystickMove(move, onNavigateCard, onNavigateDeck);
      }
      if (moves.length < 1) {
        setPathHint("");
      }
    },
    [disabled, onNavigateCard, onNavigateDeck],
  );

  const handleStart = useCallback(() => {
    lastGestureRef.current = null;
    setPathHint("");
  }, []);

  return (
    <section className="powerfistJoystickControls" aria-label="Matrix navigation">
      <div className="powerfistJoystickTarget">
        <span className="powerfistJoystickTargetLabel">Target</span>
        <CyberdeckRollingPicker
          items={paneRollerItems}
          value={targetPane}
          onChange={onTargetPaneChange}
          ariaLabel="PowerFist target pane"
          viewportClassName="powerfistPaneRollerViewport powerfistPaneRollerViewportJoystick"
          alwaysShowLabel
          showTextWhileScrolling
          loop
        />
      </div>

      <div className="powerfistJoystickPad" data-testid="powerfist-joystick">
        <Joystick
          size={112}
          stickSize={44}
          baseColor="rgba(8, 17, 13, 0.94)"
          stickColor="rgba(134, 239, 172, 0.92)"
          minDistance={15}
          throttle={40}
          disabled={disabled}
          move={handleMove}
          stop={handleStop}
          start={handleStart}
        />
        <p className="powerfistJoystickHint" aria-live="polite">
          {pathHint || "Drag // release to step deck + hand"}
        </p>
      </div>
    </section>
  );
}
