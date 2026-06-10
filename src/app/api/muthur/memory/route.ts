import { NextRequest, NextResponse } from "next/server";
import { bootMuthur, appendDailyMemory } from "@/muthur/boot/boot_muthur";
import { getMemory } from "@/muthur/memory/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let bootPromise: Promise<void> | null = null;

async function ensureMemoryReady(): Promise<void> {
  if (!bootPromise) {
    bootPromise = bootMuthur({ workspaceRoot: process.cwd() })
      .then(() => undefined)
      .catch((err) => {
        bootPromise = null;
        throw err;
      });
  }
  await bootPromise;
}

export async function GET() {
  try {
    await ensureMemoryReady();
    const memory = getMemory();
    await memory.ready();

    return NextResponse.json(
      {
        ok: true,
        memoryCount: memory.getMemoryCount(),
        recent: memory.all(8).map((row) => ({
          id: row.id,
          type: row.type,
          text: row.text.slice(0, 160),
          created_at: row.created_at,
        })),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Memory unavailable";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const op = typeof body.op === "string" ? body.op : "";

    if (op !== "record_turn") {
      return NextResponse.json({ error: "Unsupported op" }, { status: 400 });
    }

    const user = typeof body.user === "string" ? body.user.trim() : "";
    const assistant = typeof body.assistant === "string" ? body.assistant.trim() : "";

    if (!user || !assistant) {
      return NextResponse.json({ error: "user and assistant required" }, { status: 400 });
    }

    await ensureMemoryReady();

    const summary = `Operator: ${user.slice(0, 200)}\nMUTHUR: ${assistant.slice(0, 600)}`;
    await appendDailyMemory(summary, {
      source: "cyberdeck_chat",
      topic: "session_turn",
      user_preview: user.slice(0, 80),
      assistant_preview: assistant.slice(0, 120),
    });

    const memory = getMemory();
    return NextResponse.json({ ok: true, memoryCount: memory.getMemoryCount() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Memory write failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
