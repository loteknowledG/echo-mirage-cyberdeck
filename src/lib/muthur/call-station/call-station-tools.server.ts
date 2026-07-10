import type { ToolCall, ToolResult } from "@/lib/muthur-core/types";
import {
  callStationStorageMode,
  getCallStationRoom,
  listWaitingCallStationRooms,
  matchCallStationRoom,
  openCallStationRoom,
} from "@/lib/call-station/call-station-rooms.server";
import type { CallStationRole } from "@/lib/call-station/types";

const ROLES = new Set<CallStationRole>(["echo", "mirage", "powerfist", "any"]);

function getStringArg(call: ToolCall, key: string): string {
  const raw = call.args[key];
  return typeof raw === "string" ? raw.trim() : "";
}

function parseRole(raw: string, fallback: CallStationRole = "any"): CallStationRole {
  const lower = raw.toLowerCase() as CallStationRole;
  return ROLES.has(lower) ? lower : fallback;
}

/** Who is waiting? — AI matchmaker over durable Call Station store. */
export async function runCallStationWhoIsWaiting(call: ToolCall): Promise<ToolResult> {
  const lookingFor = parseRole(getStringArg(call, "lookingFor") || "any");
  const waiting = await listWaitingCallStationRooms({ lookingFor });
  const lines =
    waiting.length === 0
      ? ["Nobody is waiting right now."]
      : waiting.map(
          (room, i) =>
            `${i + 1}. Room ${room.code} — ${room.waitingAs} · ${room.label} (since ${room.createdAt})`,
        );

  return {
    ok: true,
    output: {
      storage: callStationStorageMode(),
      lookingFor,
      count: waiting.length,
      waiting,
      summary: lines.join("\n"),
    },
  };
}

/** Announce: I am waiting in a new room. */
export async function runCallStationOpenRoom(call: ToolCall): Promise<ToolResult> {
  const waitingAs = parseRole(getStringArg(call, "waitingAs") || "any");
  const label = getStringArg(call, "label");
  const room = await openCallStationRoom({ waitingAs, label: label || undefined });
  return {
    ok: true,
    output: {
      storage: callStationStorageMode(),
      room,
      summary: `Opened room ${room.code}. You are waiting as ${room.waitingAs}${label ? ` (${label})` : ""}. Tell the peer to ask for room ${room.code}.`,
    },
  };
}

/** Find a waiting peer; if none, open a room for the operator. */
export async function runCallStationMatch(call: ToolCall): Promise<ToolResult> {
  const lookingFor = parseRole(getStringArg(call, "lookingFor") || "any");
  const label = getStringArg(call, "label");
  const result = await matchCallStationRoom({ lookingFor, label: label || undefined });
  if (result.matched) {
    return {
      ok: true,
      output: {
        storage: callStationStorageMode(),
        matched: result.matched,
        summary: `Match found: room ${result.matched.code} — ${result.matched.waitingAs} · ${result.matched.label}.`,
      },
    };
  }
  return {
    ok: true,
    output: {
      storage: callStationStorageMode(),
      matched: null,
      opened: result.opened ?? null,
      summary: result.opened
        ? `No one waiting for ${lookingFor}. Opened room ${result.opened.code} so you can wait.`
        : `No one waiting for ${lookingFor}.`,
    },
  };
}

/** Look up a room by code or id. */
export async function runCallStationFindRoom(call: ToolCall): Promise<ToolResult> {
  const code = getStringArg(call, "code") || getStringArg(call, "roomId");
  if (!code) {
    return { ok: false, error: "code or roomId is required." };
  }
  const room = await getCallStationRoom(code);
  if (!room) {
    return {
      ok: true,
      output: {
        found: false,
        summary: `No active room for “${code}”.`,
      },
    };
  }
  return {
    ok: true,
    output: {
      found: true,
      room,
      summary: `Room ${room.code} — status ${room.status}, waitingAs ${room.waitingAs}, ${room.label}.`,
    },
  };
}
