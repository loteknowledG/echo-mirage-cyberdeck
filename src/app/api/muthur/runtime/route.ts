import { NextRequest, NextResponse } from "next/server";
import { getMuthurPersistentRuntime } from "@/lib/muthur/runtime/persistent-runtime.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const runtimeService = getMuthurPersistentRuntime();
  const state = await runtimeService.getState();
  return NextResponse.json({ ok: true, state }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const op = typeof body.op === "string" ? body.op : "";
    const runtimeService = getMuthurPersistentRuntime();

    if (op === "start_watch") {
      const intervalMs = typeof body.intervalMs === "number" ? body.intervalMs : undefined;
      const state = await runtimeService.startWatch(intervalMs);
      return NextResponse.json({ ok: true, state });
    }

    if (op === "stop_watch") {
      const state = await runtimeService.stopWatch();
      return NextResponse.json({ ok: true, state });
    }

    if (op === "patrol_now") {
      const taskLabel = typeof body.taskLabel === "string" ? body.taskLabel : "ui-patrol";
      const state = await runtimeService.patrolNow(taskLabel);
      return NextResponse.json({ ok: true, state });
    }

    if (op === "stop") {
      const state = await runtimeService.stop();
      return NextResponse.json({ ok: true, state });
    }

    if (op === "reset") {
      const state = await runtimeService.reset();
      return NextResponse.json({ ok: true, state });
    }

    return NextResponse.json({ error: `Unknown op: ${op}` }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Runtime request failed." },
      { status: 500 },
    );
  }
}
