import { NextRequest, NextResponse } from "next/server";
import { bootMuthur } from "@/muthur/boot/boot_muthur";
import { getAtlas } from "@/muthur/atlas/atlas";
import { ensureEchoMirageAtlasSeed } from "@/muthur/atlas/ensure-echo-mirage-seed";
import { mapAtlasToPaneEntities } from "@/muthur/atlas/atlas-api.server";
import { getMemory } from "@/muthur/memory/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let bootPromise: Promise<void> | null = null;

async function ensureAtlasReady(): Promise<void> {
  if (!bootPromise) {
    bootPromise = (async () => {
      await bootMuthur({ workspaceRoot: process.cwd() });
      await ensureEchoMirageAtlasSeed();
    })().catch((err) => {
      bootPromise = null;
      throw err;
    });
  }
  await bootPromise;
}

export async function GET() {
  try {
    await ensureAtlasReady();
    const atlas = getAtlas();
    const memory = getMemory();
    await memory.ready();

    return NextResponse.json(
      {
        ok: true,
        entities: mapAtlasToPaneEntities(atlas),
        memoryCount: memory.getMemoryCount(),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Atlas unavailable";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const query = typeof body.query === "string" ? body.query.trim() : "";

    if (!query) {
      return NextResponse.json({ error: "query required" }, { status: 400 });
    }

    await ensureAtlasReady();
    const atlas = getAtlas();
    const resolved = await atlas.resolveEntity(query);
    const projectCtx = await atlas.resolveProjectContext(query, "exploratory");

    return NextResponse.json({
      ok: true,
      query,
      entity: resolved.entity,
      hardRelations: resolved.hardRelations,
      softRelations: resolved.softRelations,
      sources: resolved.sources,
      memoryHits: resolved.memoryHits.map((hit) => ({
        id: hit.id,
        type: hit.type,
        text: hit.text.slice(0, 240),
        created_at: hit.created_at,
      })),
      projectContext: projectCtx,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Atlas resolve failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
