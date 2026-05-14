import type { IndicateMarker } from "./computer-use-types";

export type PresenceEvent =
  | "CURSOR_ENTER_REGION"
  | "CURSOR_EXIT_REGION"
  | "STEP_ACKNOWLEDGED";

export interface PresenceState {
  x: number;
  y: number;
  insideRegion: string | null;
  lastRegionId: string | null;
}

type PresenceListener = (event: PresenceEvent, marker: IndicateMarker) => void;

const listeners: Set<PresenceListener> = new Set();

let state: PresenceState = {
  x: -1,
  y: -1,
  insideRegion: null,
  lastRegionId: null,
};

function rectContains(px: number, py: number, x: number, y: number, halfW: number, halfH: number): boolean {
  return px >= x - halfW && px <= x + halfW && py >= y - halfH && py <= y + halfH;
}

export function isInsideRect(px: number, py: number, marker: IndicateMarker): boolean {
  const halfW = (marker.width ?? 96) / 2;
  const halfH = (marker.height ?? 56) / 2;
  return rectContains(px, py, marker.position.x, marker.position.y, halfW, halfH);
}

export function addPresenceListener(fn: PresenceListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emitPresence(event: PresenceEvent, marker: IndicateMarker): void {
  for (const listener of listeners) {
    try {
      listener(event, marker);
    } catch {
      /* drop */
    }
  }
}

export function trackCursorPosition(
  x: number,
  y: number,
  markers: readonly IndicateMarker[]
): void {
  const prevInside = state.insideRegion;
  let found = false;

  for (const marker of markers) {
    if (!marker.width || !marker.height) continue;
    if (isInsideRect(x, y, marker)) {
      state.insideRegion = marker.id;
      found = true;

      if (prevInside !== marker.id) {
        emitPresence("CURSOR_ENTER_REGION", marker);
      }
      break;
    }
  }

  if (!found && prevInside !== null) {
    const exitedMarker = markers.find((m) => m.id === prevInside);
    if (exitedMarker) {
      emitPresence("CURSOR_EXIT_REGION", exitedMarker);
    }
    state.insideRegion = null;
  }

  state.x = x;
  state.y = y;
  state.lastRegionId = state.insideRegion;
}

export function acknowledgeStepById(markerId: string, markers: readonly IndicateMarker[]): boolean {
  const marker = markers.find((m) => m.id === markerId);
  if (!marker) return false;
  emitPresence("STEP_ACKNOWLEDGED", marker);
  return true;
}

export function getPresenceState(): PresenceState {
  return { ...state };
}

export function resetPresence(): void {
  state = { x: -1, y: -1, insideRegion: null, lastRegionId: null };
}