import type { PiControlLeaseRequest } from "@/lib/muthur/control/pi-control-lease-types";

const MARKER_RE = /\[PI-CONTROL-REQUEST\]([\s\S]*?)\[\/PI-CONTROL-REQUEST\]/g;

export function formatPiControlLeaseStreamMarker(request: PiControlLeaseRequest): string {
  return `\n[PI-CONTROL-REQUEST]${JSON.stringify(request)}[/PI-CONTROL-REQUEST]\n`;
}

export function parsePiControlLeaseStreamMarker(text: string): PiControlLeaseRequest | null {
  MARKER_RE.lastIndex = 0;
  const match = MARKER_RE.exec(text);
  if (!match?.[1]) return null;
  try {
    return JSON.parse(match[1]) as PiControlLeaseRequest;
  } catch {
    return null;
  }
}

export function stripPiControlLeaseStreamMarkers(text: string): string {
  return text.replace(MARKER_RE, "").trim();
}
