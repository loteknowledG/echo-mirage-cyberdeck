import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { convertMarkdownToDocx } from "@mohtasham/md-to-docx";
import { docxFilenameFromMarkdownName } from "@/lib/markdown-to-docx-intent";

export type ConvertMarkdownToDocxResult = {
  buffer: Buffer;
  sourcePath?: string;
  outputPath?: string;
  suggestedFilename: string;
};

export async function convertMarkdownTextToDocxBuffer(markdown: string): Promise<Buffer> {
  const trimmed = markdown.trim();
  if (!trimmed) {
    throw new Error("Markdown content is empty.");
  }

  const blob = await convertMarkdownToDocx(trimmed);
  const buffer = Buffer.from(await blob.arrayBuffer());
  if (!buffer.length) {
    throw new Error("Conversion produced an empty DOCX file.");
  }
  return buffer;
}

function resolveDocxOutputPath(sourcePath: string): string {
  const ext = path.extname(sourcePath);
  const beside = sourcePath.slice(0, -ext.length) + ".docx";
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

export async function convertMarkdownFileToDocx(filePath: string): Promise<ConvertMarkdownToDocxResult> {
  const sourcePath = path.resolve(filePath.trim());
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`File not found: ${sourcePath}`);
  }

  const ext = path.extname(sourcePath).toLowerCase();
  if (ext !== ".md" && ext !== ".markdown") {
    throw new Error(`Unsupported format "${ext}". Supported: .md, .markdown`);
  }

  const markdown = fs.readFileSync(sourcePath, "utf8");
  const buffer = await convertMarkdownTextToDocxBuffer(markdown);
  const outputPath = resolveDocxOutputPath(sourcePath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buffer);

  return {
    buffer,
    sourcePath,
    outputPath,
    suggestedFilename: path.basename(outputPath),
  };
}

export async function convertMarkdownTextToDocx(options: {
  markdown: string;
  suggestedFilename?: string;
  outputPath?: string;
}): Promise<ConvertMarkdownToDocxResult> {
  const buffer = await convertMarkdownTextToDocxBuffer(options.markdown);
  const suggestedFilename = docxFilenameFromMarkdownName(options.suggestedFilename || "document.md");

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
