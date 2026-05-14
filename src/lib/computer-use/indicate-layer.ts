import type { IndicateMarker, IndicatePosition, ComputerUseResult } from "./computer-use-types";
import { emit } from "./control-lease";
import { narrate } from "./narration";

let markers: IndicateMarker[] = [];

function purgeExpiredMarkers(now = Date.now()): void {
  markers = markers.filter((marker) => {
    if (marker.ttlMs == null) return true;
    return now - marker.createdAt < marker.ttlMs;
  });
}

export function getMarkers(): readonly IndicateMarker[] {
  purgeExpiredMarkers();
  return [...markers];
}

export function getActiveMarkerCount(): number {
  return getMarkers().length;
}

export function clearMarkers(): void {
  markers = [];
  emit("INDICATE_CLEARED", { reason: "Clear requested" });
  narrate("INDICATE_CLEARED");
}

export function normalizePosition(raw: Record<string, unknown>): IndicatePosition | null {
  const x = raw.x;
  const y = raw.y;
  if (
    typeof x !== "number" ||
    typeof y !== "number" ||
    !Number.isFinite(x) ||
    !Number.isFinite(y)
  ) {
    return null;
  }
  const anchor = raw.anchor;
  const validAnchors = new Set([
    "center",
    "top-left",
    "top-right",
    "bottom-left",
    "bottom-right",
  ]);
  return {
    x,
    y,
    anchor:
      typeof anchor === "string" && validAnchors.has(anchor)
        ? (anchor as IndicatePosition["anchor"])
        : "center",
  };
}

export async function indicatePoint(
  position: IndicatePosition,
  opts?: {
    label?: string;
    style?: IndicateMarker["style"];
    color?: string;
    ttlMs?: number;
    width?: number;
    height?: number;
  }
): Promise<ComputerUseResult> {
  const start = Date.now();
  const id = `ptr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const marker: IndicateMarker = {
    id,
    position,
    label: opts?.label,
    style: opts?.style ?? "ring",
    color: opts?.color,
    ttlMs: typeof opts?.ttlMs === "number" && opts.ttlMs > 0 ? opts.ttlMs : undefined,
    createdAt: Date.now(),
  };

  purgeExpiredMarkers();
  markers.push(marker);

  emit("INDICATE_STARTED", {
    to: "MUTHUR",
    reason: opts?.label ?? "Point indicated",
    lease: { owner: "MUTHUR", scope: "observation", grantedAt: new Date().toISOString(), expiresAt: null, revocable: false, reason: opts?.label ?? "point" },
  });
  narrate("INDICATE_POINT");

  return {
    success: true,
    action: "indicate_point",
    status: "completed",
    data: { markerId: id },
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - start,
  };
}

export async function indicateHighlight(
  position: IndicatePosition,
  opts?: {
    label?: string;
    style?: IndicateMarker["style"];
    color?: string;
    ttlMs?: number;
    width?: number;
    height?: number;
  }
): Promise<ComputerUseResult> {
  const start = Date.now();
  const id = `hl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const width = typeof opts?.width === "number" && opts.width > 0 ? opts.width : 96;
  const height = typeof opts?.height === "number" && opts.height > 0 ? opts.height : 56;
  const marker: IndicateMarker = {
    id,
    position,
    label: opts?.label,
    style: opts?.style ?? "glow",
    color: opts?.color,
    ttlMs: typeof opts?.ttlMs === "number" && opts.ttlMs > 0 ? opts.ttlMs : undefined,
    createdAt: Date.now(),
    width,
    height,
  };

  purgeExpiredMarkers();
  markers.push(marker);

  emit("INDICATE_UPDATED", {
    to: "MUTHUR",
    reason: opts?.label ?? "Highlight indicated",
    lease: { owner: "MUTHUR", scope: "observation", grantedAt: new Date().toISOString(), expiresAt: null, revocable: false, reason: opts?.label ?? "highlight" },
  });
  narrate("INDICATE_HIGHLIGHT");

  return {
    success: true,
    action: "indicate_highlight",
    status: "completed",
    data: { markerId: id },
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - start,
  };
}
