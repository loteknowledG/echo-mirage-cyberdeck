import { NextResponse } from "next/server";
import { detectComputerUseMission } from "@/lib/muthur/control/computer-use-intent";
import {
  clearPiControlConflict,
  createPiControlLeaseRequest,
  denyPiControlLease,
  getPiControlLeaseSnapshot,
  grantPiControlLease,
  markPiControlConflict,
  terminateActiveLease,
  userRetakePiControl,
} from "@/lib/muthur/control/pi-control-lease-store";
import type { ComputerUseMission } from "@/lib/muthur/control/pi-control-lease-types";
import {
  releaseSynapseOperatorLease,
  syncSynapseLeaseWithPiGrant,
} from "@/lib/pi/synapse/synapse-control-lease.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ControlLeaseAction =
  | "request"
  | "grant"
  | "deny"
  | "terminate"
  | "retake"
  | "conflict"
  | "clear_conflict";

export async function GET() {
  return NextResponse.json({ ok: true, ...getPiControlLeaseSnapshot() });
}

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = body.action as ControlLeaseAction | undefined;
  if (!action) {
    return NextResponse.json({ error: "Missing action" }, { status: 400 });
  }

  switch (action) {
    case "request": {
      const message = typeof body.message === "string" ? body.message : "";
      const mission =
        (body.mission as ComputerUseMission | undefined) ??
        detectComputerUseMission(message);
      if (!mission) {
        return NextResponse.json(
          { error: "Message does not require computer-use delegation" },
          { status: 400 },
        );
      }
      const pendingRequest = createPiControlLeaseRequest(mission);
      return NextResponse.json({
        ok: true,
        ...getPiControlLeaseSnapshot(),
        pendingRequest,
      });
    }
    case "grant": {
      const durationMs =
        typeof body.durationMs === "number" ? body.durationMs : undefined;
      const result = grantPiControlLease(durationMs);
      if (!result.granted) {
        return NextResponse.json(
          { ok: false, error: result.reason ?? "Grant failed" },
          { status: 409 },
        );
      }
      try {
        await syncSynapseLeaseWithPiGrant(result.lease?.leaseDurationMs ?? durationMs ?? 15 * 60 * 1000);
      } catch (error) {
        terminateActiveLease("synapse_lease_sync_failed", { emitReceipt: true });
        return NextResponse.json(
          {
            ok: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to acquire Synapse operator lease",
          },
          { status: 503 },
        );
      }
      return NextResponse.json({
        ok: true,
        ...getPiControlLeaseSnapshot(),
        activeLease: result.lease,
      });
    }
    case "deny": {
      denyPiControlLease(
        typeof body.reason === "string" ? body.reason : "operator_denied",
      );
      await releaseSynapseOperatorLease();
      return NextResponse.json({ ok: true, ...getPiControlLeaseSnapshot() });
    }
    case "terminate": {
      const lease = terminateActiveLease(
        typeof body.reason === "string" ? body.reason : "mission_complete",
      );
      await releaseSynapseOperatorLease();
      return NextResponse.json({ ok: true, lease, ...getPiControlLeaseSnapshot() });
    }
    case "retake": {
      const result = userRetakePiControl(
        typeof body.reason === "string" ? body.reason : "user_retake",
      );
      await releaseSynapseOperatorLease();
      return NextResponse.json({ ok: true, ...result, ...getPiControlLeaseSnapshot() });
    }
    case "conflict": {
      markPiControlConflict();
      return NextResponse.json({ ok: true, ...getPiControlLeaseSnapshot() });
    }
    case "clear_conflict": {
      clearPiControlConflict();
      return NextResponse.json({ ok: true, ...getPiControlLeaseSnapshot() });
    }
    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}
