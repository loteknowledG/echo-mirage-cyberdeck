import { promises as fs } from "node:fs";
import path from "node:path";

export const DROP_BAY_MEDIA_DIR = ".muthur/drops/media";
export const DROP_BAY_MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/heic": ".heic",
  "image/heif": ".heif",
};

function mediaDirPath(): string {
  return path.join(process.cwd(), DROP_BAY_MEDIA_DIR);
}

export function dropImagePublicUrl(filename: string): string {
  return `/api/drops/media/${encodeURIComponent(filename)}`;
}

export function isAllowedDropImageType(mimeType: string): boolean {
  return ALLOWED_IMAGE_TYPES.has(mimeType.toLowerCase());
}

export async function saveDropImage(
  dropId: string,
  bytes: Buffer,
  mimeType: string,
): Promise<{ filename: string; imageUrl: string }> {
  const normalizedMime = mimeType.toLowerCase();
  if (!isAllowedDropImageType(normalizedMime)) {
    throw new Error("Unsupported image type.");
  }
  if (bytes.byteLength > DROP_BAY_MAX_IMAGE_BYTES) {
    throw new Error("Image too large (max 5 MB).");
  }

  const ext = EXT_BY_MIME[normalizedMime] ?? ".bin";
  const filename = `${dropId}${ext}`;
  const filePath = path.join(mediaDirPath(), filename);
  await fs.mkdir(mediaDirPath(), { recursive: true });
  await fs.writeFile(filePath, bytes);
  return { filename, imageUrl: dropImagePublicUrl(filename) };
}

export async function readDropImage(filename: string): Promise<{ bytes: Buffer; mimeType: string } | null> {
  const safeName = path.basename(filename);
  if (safeName !== filename) return null;

  const filePath = path.join(mediaDirPath(), safeName);
  try {
    const bytes = await fs.readFile(filePath);
    const ext = path.extname(safeName).toLowerCase();
    const mimeType =
      ext === ".jpg" || ext === ".jpeg"
        ? "image/jpeg"
        : ext === ".png"
          ? "image/png"
          : ext === ".webp"
            ? "image/webp"
            : ext === ".gif"
              ? "image/gif"
              : ext === ".heic"
                ? "image/heic"
                : ext === ".heif"
                  ? "image/heif"
                  : "application/octet-stream";
    return { bytes, mimeType };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
