import { NextResponse } from "next/server";
import {
  attachActiveCallToCase,
  declineIncoming,
  hangUpCall,
  pickUpIncoming,
} from "@/lib/property-manager/call-sessions.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const sessionId = decodeURIComponent(id);
    const body = await request.json();
    const action = body.action as string;

    let state;
    switch (action) {
      case "pick_up":
        state = await pickUpIncoming(
          sessionId,
          typeof body.caseSlug === "string" ? body.caseSlug : undefined,
        );
        break;
      case "decline":
        state = await declineIncoming(sessionId);
        break;
      case "hang_up":
        state = await hangUpCall(sessionId);
        break;
      case "attach_to_case":
        if (typeof body.caseSlug !== "string" || !body.caseSlug.trim()) {
          return NextResponse.json({ error: "caseSlug is required" }, { status: 400 });
        }
        state = await attachActiveCallToCase(sessionId, body.caseSlug.trim());
        break;
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, state });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Dialer action failed";
    console.error("[api/property-manager/call-sessions/[id]/actions][POST]", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
