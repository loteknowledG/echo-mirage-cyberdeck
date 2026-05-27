export type DropStatus = "pending" | "processed" | "failed";

export type DropImage = {
  url: string;
  mimeType?: string;
};

export type Drop = {
  id: string;
  timestamp: string;
  source: string;
  text: string;
  url: string;
  /** @deprecated Use `images` — kept for older JSONL rows. */
  imageUrl?: string;
  /** @deprecated Use `images` — kept for older JSONL rows. */
  mimeType?: string;
  images?: DropImage[];
  status: DropStatus;
};

export type CreateDropInput = {
  text?: string;
  url?: string;
  source?: string;
  imageUrl?: string;
  mimeType?: string;
  images?: DropImage[];
};

export function dropImages(drop: Pick<Drop, "imageUrl" | "mimeType" | "images">): DropImage[] {
  if (drop.images?.length) return drop.images;
  if (drop.imageUrl) return [{ url: drop.imageUrl, mimeType: drop.mimeType }];
  return [];
}

export type ListDropsOptions = {
  limit?: number;
};

export const DROP_BAY_MAX_TEXT_LENGTH = 10_000;
export const DROP_BAY_MAX_URL_LENGTH = 2_048;
export const DROP_BAY_MAX_SOURCE_LENGTH = 64;
export const DROP_BAY_MAX_IMAGES = 12;
export const DROP_BAY_DEFAULT_LIMIT = 100;
export const DROP_BAY_JSONL_PATH = ".muthur/drops.jsonl";
