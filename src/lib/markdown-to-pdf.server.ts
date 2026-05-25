import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mdToPdf } from "md-to-pdf";
import { pdfFilenameFromMarkdownName } from "@/lib/markdown-to-docx-intent";

export type ConvertMarkdownToPdfResult = {
  buffer: Buffer;
  sourcePath?: string;
  outputPath?: string;
  suggestedFilename: string;
};

export async function convertMarkdownTextToPdfBuffer(markdown: string): Promise<Buffer> {
  const trimmed = markdown.trim();
  if (!trimmed) {
    throw new Error("Markdown content is empty.");
  }

  const result = await mdToPdf(
    { content: trimmed },
    {
      pdf_options: {
        format: "a4",
        margin: {
          top: "20mm",
          bottom: "20mm",
          left: "20mm",
          right: "20mm",
        },
        printBackground: true,
      },
      launch_options: {
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      },
    },
  );

  if (!result?.content) {
    throw new Error("Conversion produced an empty PDF.");
  }

  const buffer = Buffer.isBuffer(result.content) ? result.content : Buffer.from(result.content);
  if (!buffer.length) {
    throw new Error("Conversion produced an empty PDF.");
  }
  return buffer;
}

function resolvePdfOutputPath(sourcePath: string): string {
  const ext = path.extname(sourcePath);
  const beside = sourcePath.slice(0, -ext.length) + ".pdf";
  const dir = path.dirname(beside);
  if (fs.existsSync(dir)) {
    try {
      fs.accessSync(dir, fs.constants.W_OK);
      return beside;
    } catch {
      /* fall through to temp */
    }
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "echo-mirage-export-"));
  return path.join(tmpDir, path.basename(beside));
}

export async function convertMarkdownFileToPdf(filePath: string): Promise<ConvertMarkdownToPdfResult> {
  const sourcePath = path.resolve(filePath.trim());
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`File not found: ${sourcePath}`);
  }

  const ext = path.extname(sourcePath).toLowerCase();
  if (ext !== ".md" && ext !== ".markdown") {
    throw new Error(`Unsupported format "${ext}". Supported: .md, .markdown`);
  }

  const markdown = fs.readFileSync(sourcePath, "utf8");
  const buffer = await convertMarkdownTextToPdfBuffer(markdown);
  const outputPath = resolvePdfOutputPath(sourcePath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buffer);

  return {
    buffer,
    sourcePath,
    outputPath,
    suggestedFilename: path.basename(outputPath),
  };
}

export async function convertMarkdownTextToPdf(options: {
  markdown: string;
  suggestedFilename?: string;
  outputPath?: string;
}): Promise<ConvertMarkdownToPdfResult> {
  const buffer = await convertMarkdownTextToPdfBuffer(options.markdown);
  const suggestedFilename = pdfFilenameFromMarkdownName(options.suggestedFilename || "document.md");

  if (options.outputPath) {
    const outputPath = path.resolve(options.outputPath.trim());
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, buffer);
    return {
      buffer,
      outputPath,
      suggestedFilename: path.basename(outputPath),
    };
  }

  return { buffer, suggestedFilename };
}
