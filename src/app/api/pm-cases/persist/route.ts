import { NextResponse } from "next/server";
import type { PmCallEpisodeDigest, PmCallTurn } from "@/lib/pm-call-center/types";
import { persistPmCall } from "@/lib/property-manager/cases/persist-call.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseTurns(value: unknown): PmCallTurn[] | null {
  if (!Array.isArray(value)) return null;
  const turns: PmCallTurn[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const turn = item as Partial<PmCallTurn>;
    if (
      typeof turn.id !== "string" ||
      typeof turn.role !== "string" ||
      typeof turn.text !== "string" ||
      typeof turn.at !== "number"
    ) {
      return null;
    }
    if (turn.role !== "resident" && turn.role !== "operator" && turn.role !== "system") {
      return null;
    }
    turns.push({
      id: turn.id,
      role: turn.role,
      text: turn.text,
      at: turn.at,
      ...(typeof turn.notes === "string" && turn.notes.trim() ? { notes: turn.notes } : {}),
    });
  }
  return turns;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const scenarioId = typeof body.scenarioId === "string" ? body.scenarioId.trim() : "";
    const turns = parseTurns(body.turns);
    const digest = body.digest as PmCallEpisodeDigest | undefined;
    const startedAt = typeof body.startedAt === "number" ? body.startedAt : NaN;
    const endedAt = typeof body.endedAt === "number" ? body.endedAt : NaN;
    const attachCaseSlug =
      typeof body.attachCaseSlug === "string" && body.attachCaseSlug.trim()
        ? body.attachCaseSlug.trim()
        : undefined;

    if (!scenarioId || !turns || !digest || !Number.isFinite(startedAt) || !Number.isFinite(endedAt)) {
      return NextResponse.json({ error: "Invalid persist payload" }, { status: 400 });
    }

    const result = await persistPmCall({
      scenarioId,
      turns,
      digest,
      startedAt,
      endedAt,
      attachCaseSlug,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[api/pm-cases/persist][error]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Persist failed" },
      { status: 500 },
    );
  }
}
