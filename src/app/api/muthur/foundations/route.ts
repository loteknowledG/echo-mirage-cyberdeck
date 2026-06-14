import { NextRequest, NextResponse } from "next/server";

import {
  getFoundationById,
  loadFoundationManifest,
  readFoundationArtifactText,
  readFoundationExcerpt,
  verifyFoundationIntegrity,
} from "@/muthur/foundations/foundation-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const workspaceRoot = process.cwd();
    const id = req.nextUrl.searchParams.get("id")?.trim() ?? "";
    const wantsContent = req.nextUrl.searchParams.get("content") === "1";
    const excerptLinesRaw = req.nextUrl.searchParams.get("excerpt")?.trim() ?? "";
    const excerptLines = excerptLinesRaw ? Number.parseInt(excerptLinesRaw, 10) : 0;

    if (!id) {
      const manifest = loadFoundationManifest(workspaceRoot);
      const items = manifest.foundations.map((entry) => ({
        id: entry.id,
        name: entry.name,
        classification: entry.classification,
        role: entry.role,
        immutable: entry.immutable,
        lineage_priority: entry.lineage_priority,
        source_system: entry.source_system,
        destination_path: entry.destination_path,
        sha256: entry.sha256,
        preserved_at: entry.preserved_at,
        integrity: verifyFoundationIntegrity(entry.id, workspaceRoot),
      }));
      return NextResponse.json(
        {
          ok: true,
          classification: manifest.classification,
          schema_version: manifest.schema_version,
          foundations: items,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const entry = getFoundationById(id, workspaceRoot);
    if (!entry) {
      return NextResponse.json({ ok: false, error: `Foundation not found: ${id}` }, { status: 404 });
    }

    const integrity = verifyFoundationIntegrity(id, workspaceRoot);

    if (wantsContent) {
      const { text, artifactPath } = await readFoundationArtifactText(id, workspaceRoot);
      return NextResponse.json(
        {
          ok: true,
          read_only: true,
          entry,
          integrity,
          artifact_path: artifactPath,
          content: text,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    if (Number.isFinite(excerptLines) && excerptLines > 0) {
      const { text, artifactPath } = await readFoundationArtifactText(id, workspaceRoot);
      const excerpt = readFoundationExcerpt(text, excerptLines);
      return NextResponse.json(
        {
          ok: true,
          read_only: true,
          entry,
          integrity,
          artifact_path: artifactPath,
          excerpt: excerpt.lines.join("\n"),
          excerpt_lines: excerpt.lines.length,
          total_lines: excerpt.totalLines,
          truncated: excerpt.truncated,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        read_only: true,
        entry,
        integrity,
        retrieval: {
          content: `/api/muthur/foundations?id=${encodeURIComponent(id)}&content=1`,
          excerpt: `/api/muthur/foundations?id=${encodeURIComponent(id)}&excerpt=40`,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Foundation retrieval failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
