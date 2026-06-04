import { NextRequest, NextResponse } from "next/server";
import { convertDocumentToMarkdown } from "@/lib/muthur-document-conversion.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      filePath?: string;
      activeFilePath?: string;
      localFilePath?: string;
      folderRoots?: Array<{ name?: string; diskPath?: string }>;
    };
    const filePath = body.filePath?.trim();

    if (!filePath) {
      return NextResponse.json({ ok: false, error: "filePath is required" }, { status: 400 });
    }

    const folderRoots =
      body.folderRoots
        ?.filter((root) => root.name?.trim() && root.diskPath?.trim())
        .map((root) => ({
          id: root.name!.trim(),
          name: root.name!.trim(),
          diskPath: root.diskPath!.trim(),
        })) ?? [];

    const result = convertDocumentToMarkdown(filePath, {
      activeFilePath: body.activeFilePath?.trim() || null,
      localFilePath: body.localFilePath?.trim() || null,
      folderRoots,
    });

    return NextResponse.json({
      ok: true,
      markdown: result.markdown,
      sourcePath: result.sourcePath,
      outputPath: result.outputPath,
      format: result.format,
      mimeType: "text/markdown",
      kind: "markdown",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Document conversion failed",
      },
      { status: 500 },
    );
  }
}
