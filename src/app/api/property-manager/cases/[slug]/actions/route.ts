import { NextResponse } from "next/server";
import type { CaseActionId } from "@/lib/property-manager/actions";
import { applyCaseAction } from "@/lib/property-manager/cases/apply-case-action.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_ACTIONS = new Set<CaseActionId>([
  "assign_technician",
  "add_eta",
  "mark_en_route",
  "mark_on_site",
  "mark_repair_in_progress",
  "mark_resolved",
  "verify_resolution",
  "close_case",
  "escalate_emergency",
  "send_resident_update",
  "add_operator_note",
]);

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const body = await request.json();
    const action = body.action as CaseActionId;

    if (!action || !VALID_ACTIONS.has(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const detail = await applyCaseAction(decodeURIComponent(slug), {
      action,
      ...(body.input ? { input: body.input } : {}),
    } as Parameters<typeof applyCaseAction>[1]);

    return NextResponse.json({ ok: true, detail });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Action failed";
    const status = message.includes("Cannot ") || message.includes("before ") || message.includes("required")
      ? 400
      : 500;
    console.error("[api/property-manager/cases/[slug]/actions][error]", error);
    return NextResponse.json({ error: message }, { status });
  }
}
