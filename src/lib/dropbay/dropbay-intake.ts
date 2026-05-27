import { nanoid } from "nanoid";
import { validateCreateDropInput } from "@/lib/dropbay/dropbay-jsonl-store";
import { getDropStore } from "@/lib/dropbay/dropbay-store";
import { saveDropImage } from "@/lib/dropbay/dropbay-media";
import type { CreateDropInput, Drop } from "@/lib/dropbay/dropbay-types";

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

export async function intakeDropFromFormData(form: FormData): Promise<Drop> {
  const text = readFormField(form, "text");
  const url = readFormField(form, "url");
  const source = readFormField(form, "source") || "android";
  const imageEntry = form.get("image");

  let imageUrl: string | undefined;
  let mimeType: string | undefined;
  const dropId = `drop_${nanoid()}`;

  if (imageEntry instanceof File && imageEntry.size > 0) {
    const bytes = Buffer.from(await imageEntry.arrayBuffer());
    const saved = await saveDropImage(dropId, bytes, imageEntry.type || "application/octet-stream");
    imageUrl = saved.imageUrl;
    mimeType = imageEntry.type || undefined;
  }

  const input: CreateDropInput = { text, url, source, imageUrl, mimeType };
  const validationError = validateCreateDropInput(input);
  if (validationError) throw new Error(validationError);

  const drop: Drop = {
    id: dropId,
    timestamp: new Date().toISOString(),
    source: source.slice(0, 64) || "unknown",
    text: text.slice(0, 10_000),
    url: url.slice(0, 2_048),
    imageUrl,
    mimeType,
    status: "pending",
  };

  await getDropStore().persistDrop(drop);
  await getDropStore().broadcastDrop(drop);
  return drop;
}
