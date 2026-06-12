import { NextResponse } from "next/server";
import type { SimulatedInboundPresetId } from "@/lib/property-manager/call-sessions";
import {
  dialOutbound,
  getDialerState,
  simulateInbound,
} from "@/lib/property-manager/call-sessions.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const state = await getDialerState();
    return NextResponse.json(state);
  } catch (error) {
    console.error("[api/property-manager/call-sessions][GET]", error);
    return NextResponse.json({ error: "Failed to load dialer state" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body.action as string;

    if (action === "dial_outbound") {
      const state = await dialOutbound({
        phoneNumber: String(body.phoneNumber ?? ""),
        caseSlug: typeof body.caseSlug === "string" ? body.caseSlug : undefined,
        participantType: body.participantType,
        participantName: typeof body.participantName === "string" ? body.participantName : undefined,
      });
      return NextResponse.json({ ok: true, state });
    }

    if (action === "simulate_inbound") {
      const preset = body.preset as SimulatedInboundPresetId;
      const state = await simulateInbound(preset);
      return NextResponse.json({ ok: true, state });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Dialer action failed";
    console.error("[api/property-manager/call-sessions][POST]", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
