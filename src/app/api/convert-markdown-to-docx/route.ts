import { NextRequest, NextResponse } from "next/server";
import { convertMarkdownTextToDocx } from "@/lib/markdown-to-docx.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      markdown?: string;
      suggestedFilename?: string;
      outputPath?: string;
      filePath?: string;
    };

    if (body.filePath?.trim() && !body.markdown) {
      const { convertMarkdownFileToDocx } = await import("@/lib/markdown-to-docx.server");
      const result = await convertMarkdownFileToDocx(body.filePath.trim());
      return NextResponse.json({
        ok: true,
        sourcePath: result.sourcePath,
        outputPath: result.outputPath,
        suggestedFilename: result.suggestedFilename,
        mimeType: DOCX_MIME,
        kind: "docx",
      });
    }

    const markdown = body.markdown?.trim();
    if (!markdown) {
      return NextResponse.json({ ok: false, error: "markdown is required" }, { status: 400 });
    }

    const result = await convertMarkdownTextToDocx({
      markdown,
      suggestedFilename: body.suggestedFilename,
      outputPath: body.outputPath?.trim(),
    });

    if (body.outputPath?.trim()) {
      return NextResponse.json({
        ok: true,
        outputPath: result.outputPath,
        suggestedFilename: result.suggestedFilename,
        mimeType: DOCX_MIME,
        kind: "docx",
      });
    }

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": DOCX_MIME,
        "Content-Disposition": `attachment; filename="${result.suggestedFilename}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Markdown to DOCX conversion failed",
      },
      { status: 500 },
    );
  }
}
