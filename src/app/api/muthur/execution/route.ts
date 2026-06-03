import { NextRequest, NextResponse } from "next/server";
import { readScreenshotPng } from "@/lib/muthur/browser/serve-screenshot.server";
import { getMuthurExecutionLoop } from "@/lib/muthur/execution/execution-loop";
import {
  MUTHUR_EXECUTION_MODES,
  type CreateMuthurActionInput,
  type MuthurExecutionMode,
} from "@/lib/muthur/execution/execution-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isExecutionMode(value: unknown): value is MuthurExecutionMode {
  return typeof value === "string" && (MUTHUR_EXECUTION_MODES as readonly string[]).includes(value);
}

export async function GET(req: NextRequest) {
  const screenshot = req.nextUrl.searchParams.get("screenshot")?.trim();
  if (screenshot) {
    const result = await readScreenshotPng(screenshot);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return new NextResponse(new Uint8Array(result.data), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  }

  const loop = getMuthurExecutionLoop();
  return NextResponse.json({ ok: true, state: loop.getState() });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const op = typeof body.op === "string" ? body.op : "";
    const loop = getMuthurExecutionLoop();

    if (op === "set_mode") {
      if (!isExecutionMode(body.mode)) {
        return NextResponse.json({ error: "Invalid execution mode." }, { status: 400 });
      }
      loop.setMode(body.mode);
      return NextResponse.json({ ok: true, state: loop.getState() });
    }

    if (op === "stop") {
      loop.stop();
      return NextResponse.json({ ok: true, state: loop.getState() });
    }

    if (op === "pause") {
      loop.pause();
      return NextResponse.json({ ok: true, state: loop.getState() });
    }

    if (op === "resume") {
      loop.resume();
      return NextResponse.json({ ok: true, state: loop.getState() });
    }

    if (op === "clear_queue") {
      const removed = loop.clearQueue();
      return NextResponse.json({ ok: true, removed, state: loop.getState() });
    }

    if (op === "approve") {
      const actionId = typeof body.actionId === "string" ? body.actionId : "";
      if (!actionId) return NextResponse.json({ error: "actionId required." }, { status: 400 });
      const ok = loop.approve(actionId);
      return NextResponse.json({ ok, state: loop.getState() }, { status: ok ? 200 : 404 });
    }

    if (op === "deny") {
      const actionId = typeof body.actionId === "string" ? body.actionId : "";
      if (!actionId) return NextResponse.json({ error: "actionId required." }, { status: 400 });
      const ok = loop.deny(actionId);
      return NextResponse.json({ ok, state: loop.getState() }, { status: ok ? 200 : 404 });
    }

    if (op === "verify_route") {
      const route = typeof body.route === "string" ? body.route : "/cyberdeck";
      const baseUrl = typeof body.base_url === "string" ? body.base_url : undefined;
      if (isExecutionMode(body.mode)) loop.setMode(body.mode);
      else loop.setMode("execute");
      const created = loop.enqueue(
        [
          {
            type: "open_url",
            source: "system",
            payload: {
              route,
              base_url: baseUrl,
              verify_after: true,
              wait_for_selector: route === "/cyberdeck" ? "cyberdeck-rail-tab" : undefined,
              screenshot_label: `verify-${route.replace(/\W+/g, "_")}`,
            },
          },
        ],
        { taskLabel: typeof body.taskLabel === "string" ? body.taskLabel : `verify-route${route}` },
      );
      const wait = body.wait !== false;
      if (wait) {
        await loop.waitForIdle(typeof body.timeoutMs === "number" ? body.timeoutMs : 120_000);
      }
      const state = loop.getState();
      const createdIds = new Set(created.map((action) => action.id));
      const results = state.completed_actions.filter((action) => createdIds.has(action.id));
      return NextResponse.json({ ok: true, created, results, state });
    }

    if (op === "enqueue") {
      const actions = body.actions;
      if (!Array.isArray(actions) || actions.length === 0) {
        return NextResponse.json({ error: "actions array required." }, { status: 400 });
      }

      const normalized: CreateMuthurActionInput[] = actions.map((raw) => {
        const item = raw as CreateMuthurActionInput;
        return {
          type: item.type,
          payload: item.payload ?? {},
          source: item.source ?? "user",
          requires_confirmation: item.requires_confirmation,
        };
      });

      if (isExecutionMode(body.mode)) {
        loop.setMode(body.mode);
      }

      const created = loop.enqueue(normalized, {
        taskLabel: typeof body.taskLabel === "string" ? body.taskLabel : undefined,
      });

      const wait = body.wait === true;
      if (wait) {
        const timeoutMs = typeof body.timeoutMs === "number" ? body.timeoutMs : 120_000;
        await loop.waitForIdle(timeoutMs);
      }

      const state = loop.getState();
      const createdIds = new Set(created.map((action) => action.id));
      const results = state.completed_actions.filter((action) => createdIds.has(action.id));

      return NextResponse.json({
        ok: true,
        created,
        results,
        state,
      });
    }

    return NextResponse.json({ error: `Unknown op: ${op}` }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Execution request failed." },
      { status: 500 },
    );
  }
}
