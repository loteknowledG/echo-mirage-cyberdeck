import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CONVERTIBLE_DOCUMENT_EXTENSIONS } from "@/lib/muthur-document-conversion-intent";
import { applyOperatorMarkdownHousekeeping } from "@/lib/operator-markdown-housekeeping";

export type ConvertDocumentResult = {
  markdown: string;
  sourcePath: string;
  outputPath: string;
  format: string;
};

function quoteShellArg(value: string): string {
  if (process.platform === "win32") {
    return `"${value.replace(/"/g, '\\"')}"`;
  }
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function detectFormat(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".pdf") return "pdf";
  if (ext === ".docx") return "docx";
  return ext.replace(/^\./, "") || "unknown";
}

function runMarkitdown(inputPath: string, outputPath: string): void {
  const quotedIn = quoteShellArg(inputPath);
  const quotedOut = quoteShellArg(outputPath);
  const attempts = [
    `markitdown ${quotedIn} -o ${quotedOut}`,
    `python -m markitdown ${quotedIn} -o ${quotedOut}`,
    `py -m markitdown ${quotedIn} -o ${quotedOut}`,
  ];

  let lastError: Error | null = null;
  for (const command of attempts) {
    try {
      execSync(command, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 120_000,
        windowsHide: true,
      });
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw new Error(
    lastError?.message ||
      "MarkItDown failed. Install with: pip install 'markitdown[pdf,docx]'",
  );
}

function resolveOutputPath(sourcePath: string): string {
  const ext = path.extname(sourcePath);
  const beside = sourcePath.slice(0, -ext.length) + ".md";
  const dir = path.dirname(beside);
  if (fs.existsSync(dir)) {
    try {
      fs.accessSync(dir, fs.constants.W_OK);
      return beside;
    } catch {
      /* fall through to temp */
    }
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "echo-mirage-import-"));
  return path.join(tmpDir, path.basename(beside));
}

export function convertDocumentToMarkdown(filePath: string): ConvertDocumentResult {
  const sourcePath = path.resolve(filePath.trim());

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`File not found: ${sourcePath}`);
  }

  const ext = path.extname(sourcePath).toLowerCase();
  if (!CONVERTIBLE_DOCUMENT_EXTENSIONS.includes(ext as (typeof CONVERTIBLE_DOCUMENT_EXTENSIONS)[number])) {
    throw new Error(
      `Unsupported format "${ext}". Supported: ${CONVERTIBLE_DOCUMENT_EXTENSIONS.join(", ")}`,
    );
  }

  const outputPath = resolveOutputPath(sourcePath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  runMarkitdown(sourcePath, outputPath);

  if (!fs.existsSync(outputPath)) {
    throw new Error(`MarkItDown did not produce output at ${outputPath}`);
  }

  const rawMarkdown = fs.readFileSync(outputPath, "utf8");
  if (!rawMarkdown.trim()) {
    throw new Error("Conversion produced empty markdown.");
  }

  const markdown = applyOperatorMarkdownHousekeeping(rawMarkdown);
  if (markdown !== rawMarkdown) {
    fs.writeFileSync(outputPath, markdown, "utf8");
  }

  return {
    markdown,
    sourcePath,
    outputPath,
    format: detectFormat(sourcePath),
  };
}
