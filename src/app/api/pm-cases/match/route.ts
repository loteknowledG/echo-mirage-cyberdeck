import { NextResponse } from "next/server";
import { pmCallScenarioById } from "@/lib/pm-call-center/scenarios";
import { findMatchingOpenCases } from "@/lib/property-manager/cases/matching.server";
import { buildLookupKey, scenarioCaseContext } from "@/lib/property-manager/cases/scenario-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const scenarioId = searchParams.get("scenarioId")?.trim() ?? "";
    const scenario = pmCallScenarioById(scenarioId);
    if (!scenario) {
      return NextResponse.json({ error: "Unknown scenario" }, { status: 400 });
    }

    const ctx = scenarioCaseContext(scenario);
    const matches = await findMatchingOpenCases(ctx);

    return NextResponse.json({
      scenarioId,
      lookupKey: buildLookupKey(ctx),
      matches,
      bestMatch: matches[0] ?? null,
    });
  } catch (error) {
    console.error("[api/pm-cases/match][error]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Match failed" },
      { status: 500 },
    );
  }
}
