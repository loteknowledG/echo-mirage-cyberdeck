export type PowerfistJoystickMove = "card-left" | "card-right" | "deck-up" | "deck-down";

/** Normalized axis magnitude required to count as diagonal (x/y are roughly -1..1). */
const DIAGONAL_AXIS_MIN = 0.34;

/** Dominant axis threshold for cardinals. */
const CARDINAL_AXIS_MIN = 0.28;

/**
 * Map react-joystick-component x/y to matrix moves.
 * Diagonal paths run horizontal first, then vertical (e.g. top-right → right, up).
 */
export function resolvePowerfistJoystickMoves(
  x: number | null | undefined,
  y: number | null | undefined,
  distance: number | null | undefined,
  minDistance = 18,
): PowerfistJoystickMove[] {
  if (x == null || y == null || distance == null || distance < minDistance) {
    return [];
  }

  const ax = Math.abs(x);
  const ay = Math.abs(y);
  const horizontal = ax >= DIAGONAL_AXIS_MIN;
  const vertical = ay >= DIAGONAL_AXIS_MIN;

  if (horizontal && vertical) {
    const moves: PowerfistJoystickMove[] = [];
    moves.push(x > 0 ? "card-right" : "card-left");
    moves.push(y > 0 ? "deck-up" : "deck-down");
    return moves;
  }

  if (ax >= ay && ax >= CARDINAL_AXIS_MIN) {
    return [x > 0 ? "card-right" : "card-left"];
  }

  if (ay >= CARDINAL_AXIS_MIN) {
    return [y > 0 ? "deck-up" : "deck-down"];
  }

  return [];
}

export function describePowerfistJoystickPath(moves: PowerfistJoystickMove[]): string {
  if (moves.length < 1) return "";
  return moves
    .map((move) => {
      switch (move) {
        case "card-left":
          return "1 left";
        case "card-right":
          return "1 right";
        case "deck-up":
          return "1 up";
        case "deck-down":
          return "1 down";
        default: {
          const never: never = move;
          return never;
        }
      }
    })
    .join(" then ");
}
