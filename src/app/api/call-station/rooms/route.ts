import { NextResponse } from "next/server";
import {
  callStationStorageMode,
  listWaitingCallStationRooms,
  matchCallStationRoom,
  openCallStationRoom,
} from "@/lib/call-station/call-station-rooms.server";
import type { CallStationRole } from "@/lib/call-station/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROLES = new Set<CallStationRole>(["echo", "mirage", "powerfist", "any"]);

function parseRole(raw: unknown, fallback: CallStationRole = "any"): CallStationRole {
  if (typeof raw === "string" && ROLES.has(raw as CallStationRole)) {
    return raw as CallStationRole;
  }
  return fallback;
}

/** List waiting rooms (AI matchmaker truth). */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lookingFor = parseRole(searchParams.get("lookingFor"));
  const waiting = await listWaitingCallStationRooms({ lookingFor });
  return NextResponse.json({
    ok: true,
    storage: callStationStorageMode(),
    lookingFor,
    waiting,
    count: waiting.length,
  });
}

/** Open a waiting room or match into one. */
export async function POST(request: Request) {
  let body: { action?: string; waitingAs?: string; lookingFor?: string; label?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, reason: "Invalid JSON." }, { status: 400 });
  }

  const action = body.action?.trim() || "open";
  const label = typeof body.label === "string" ? body.label : undefined;

  if (action === "open") {
    const waitingAs = parseRole(body.waitingAs, "any");
    const room = await openCallStationRoom({ waitingAs, label });
    return NextResponse.json({
      ok: true,
      storage: callStationStorageMode(),
      room,
      message: `Room ${room.code} open — ${room.waitingAs} waiting.`,
    });
  }

  if (action === "match") {
    const lookingFor = parseRole(body.lookingFor ?? body.waitingAs, "any");
    const result = await matchCallStationRoom({ lookingFor, label });
    if (result.matched) {
      return NextResponse.json({
        ok: true,
        storage: callStationStorageMode(),
        matched: result.matched,
        message: `Matched room ${result.matched.code} (${result.matched.label}).`,
      });
    }
    return NextResponse.json({
      ok: true,
      storage: callStationStorageMode(),
      matched: null,
      opened: result.opened,
      message: result.opened
        ? `Nobody waiting — opened room ${result.opened.code} for you.`
        : "Nobody waiting.",
    });
  }

  return NextResponse.json({ ok: false, reason: `Unknown action: ${action}` }, { status: 400 });
}
