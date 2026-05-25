import { NextRequest, NextResponse } from "next/server";
import { convertMarkdownTextToPdf } from "@/lib/markdown-to-pdf.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PDF_MIME = "application/pdf";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      markdown?: string;
      suggestedFilename?: string;
      outputPath?: string;
      filePath?: string;
    };

    if (body.filePath?.trim() && !body.markdown) {
      const { convertMarkdownFileToPdf } = await import("@/lib/markdown-to-pdf.server");
      const result = await convertMarkdownFileToPdf(body.filePath.trim());
      return NextResponse.json({
        ok: true,
        sourcePath: result.sourcePath,
        outputPath: result.outputPath,
        suggestedFilename: result.suggestedFilename,
        mimeType: PDF_MIME,
        kind: "pdf",
      });
    }

    const markdown = body.markdown?.trim();
    if (!markdown) {
      return NextResponse.json({ ok: false, error: "markdown is required" }, { status: 400 });
    }

    const result = await convertMarkdownTextToPdf({
      markdown,
      suggestedFilename: body.suggestedFilename,
      outputPath: body.outputPath?.trim(),
    });

    if (body.outputPath?.trim()) {
      return NextResponse.json({
        ok: true,
        outputPath: result.outputPath,
        suggestedFilename: result.suggestedFilename,
        mimeType: PDF_MIME,
        kind: "pdf",
      });
    }

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": PDF_MIME,
        "Content-Disposition": `attachment; filename="${result.suggestedFilename}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Markdown to PDF conversion failed",
      },
      { status: 500 },
    );
  }
}
