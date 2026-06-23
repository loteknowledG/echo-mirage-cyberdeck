"use client";

import { useCallback, useRef, useState } from "react";
import { Joystick } from "react-joystick-component";
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

/** Repeat interval while the stick is held (ms). */
const JOYSTICK_REPEAT_MS = 130;

type PowerfistJoystickControlsProps = {
  disabled?: boolean;
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

function pathKey(moves: PowerfistJoystickMove[]): string {
  return moves.join("|");
}

export function PowerfistJoystickControls({
  disabled = false,
  onNavigateCard,
  onNavigateDeck,
}: PowerfistJoystickControlsProps) {
  const activePathRef = useRef<PowerfistJoystickMove[]>([]);
  const pathStepRef = useRef(0);
  const lastFireAtRef = useRef(0);
  const [pathHint, setPathHint] = useState("");

  const firePathStep = useCallback(
    (moves: PowerfistJoystickMove[]) => {
      if (moves.length < 1) return;
      const step = pathStepRef.current % moves.length;
      applyJoystickMove(moves[step], onNavigateCard, onNavigateDeck);
      pathStepRef.current = step + 1;
      lastFireAtRef.current = Date.now();
    },
    [onNavigateCard, onNavigateDeck],
  );

  const handleMove = useCallback(
    (event: JoystickUpdateEvent) => {
      if (disabled) return;
      if (event.x == null || event.y == null || event.distance == null) return;

      const moves = resolvePowerfistJoystickMoves(event.x, event.y, event.distance);
      setPathHint(describePowerfistJoystickPath(moves));

      if (moves.length < 1) {
        activePathRef.current = [];
        pathStepRef.current = 0;
        return;
      }

      const nextKey = pathKey(moves);
      const activeKey = pathKey(activePathRef.current);
      const now = Date.now();

      if (nextKey !== activeKey) {
        activePathRef.current = moves;
        pathStepRef.current = 0;
        firePathStep(moves);
        return;
      }

      if (now - lastFireAtRef.current < JOYSTICK_REPEAT_MS) return;
      firePathStep(moves);
    },
    [disabled, firePathStep],
  );

  const handleStop = useCallback(() => {
    activePathRef.current = [];
    pathStepRef.current = 0;
    lastFireAtRef.current = 0;
    setPathHint("");
  }, []);

  const handleStart = useCallback(() => {
    activePathRef.current = [];
    pathStepRef.current = 0;
    lastFireAtRef.current = 0;
    setPathHint("");
  }, []);

  return (
    <div className="powerfistJoystickFab" data-testid="powerfist-joystick" aria-label="Matrix navigation">
      <Joystick
        size={96}
        stickSize={38}
        baseColor="rgba(8, 17, 13, 0.94)"
        stickColor="rgba(134, 239, 172, 0.92)"
        minDistance={15}
        throttle={16}
        disabled={disabled}
        move={handleMove}
        stop={handleStop}
        start={handleStart}
      />
      {pathHint ? (
        <p className="powerfistJoystickHint" aria-live="polite">
          {pathHint}
        </p>
      ) : null}
    </div>
  );
}
