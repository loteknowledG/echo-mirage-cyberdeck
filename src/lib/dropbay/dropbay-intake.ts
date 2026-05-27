import { nanoid } from "nanoid";
import { validateCreateDropInput } from "@/lib/dropbay/dropbay-jsonl-store";
import { getDropStore } from "@/lib/dropbay/dropbay-store";
import { saveDropImage } from "@/lib/dropbay/dropbay-media";
import type { CreateDropInput, Drop, DropImage } from "@/lib/dropbay/dropbay-types";
import { DROP_BAY_MAX_IMAGES } from "@/lib/dropbay/dropbay-types";

export function parseDropQueryParams(searchParams: URLSearchParams): CreateDropInput {
  return {
    text: searchParams.get("text") ?? undefined,
    url: searchParams.get("url") ?? undefined,
    source: searchParams.get("source") ?? undefined,
  };
}

export async function intakeDrop(input: CreateDropInput): Promise<Drop> {
  return getDropStore().createDrop(input);
}

function readFormField(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readImageFiles(form: FormData): File[] {
  const fromImages = form
    .getAll("images")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (fromImages.length > 0) return fromImages;

  const legacy = form.get("image");
  if (legacy instanceof File && legacy.size > 0) return [legacy];
  return [];
}

export async function intakeDropFromFormData(form: FormData): Promise<Drop> {
  const text = readFormField(form, "text");
  const url = readFormField(form, "url");
  const source = readFormField(form, "source") || "android";
  const imageFiles = readImageFiles(form);

  if (imageFiles.length > DROP_BAY_MAX_IMAGES) {
    throw new Error(`Too many images (max ${DROP_BAY_MAX_IMAGES}).`);
  }

  const dropId = `drop_${nanoid()}`;
  const images: DropImage[] = [];

  for (let index = 0; index < imageFiles.length; index += 1) {
    const file = imageFiles[index];
    const bytes = Buffer.from(await file.arrayBuffer());
    const saved = await saveDropImage(
      dropId,
      bytes,
      file.type || "application/octet-stream",
      index,
    );
    images.push({ url: saved.imageUrl, mimeType: file.type || undefined });
  }

  const input: CreateDropInput = { text, url, source, images };
  const validationError = validateCreateDropInput(input);
  if (validationError) throw new Error(validationError);

  const drop: Drop = {
    id: dropId,
    timestamp: new Date().toISOString(),
    source: source.slice(0, 64) || "unknown",
    text: text.slice(0, 10_000),
    url: url.slice(0, 2_048),
    images: images.length > 0 ? images : undefined,
    imageUrl: images[0]?.url,
    mimeType: images[0]?.mimeType,
    status: "pending",
  };

  await getDropStore().persistDrop(drop);
  await getDropStore().broadcastDrop(drop);
  return drop;
}
