export type DropStatus = "pending" | "processed" | "failed";

export type Drop = {
  id: string;
  timestamp: string;
  source: string;
  text: string;
  url: string;
  imageUrl?: string;
  mimeType?: string;
  status: DropStatus;
};

export type CreateDropInput = {
  text?: string;
  url?: string;
  source?: string;
  imageUrl?: string;
  mimeType?: string;
};

export type ListDropsOptions = {
  limit?: number;
};

export const DROP_BAY_MAX_TEXT_LENGTH = 10_000;
export const DROP_BAY_MAX_URL_LENGTH = 2_048;
export const DROP_BAY_MAX_SOURCE_LENGTH = 64;
export const DROP_BAY_DEFAULT_LIMIT = 100;
export const DROP_BAY_JSONL_PATH = ".muthur/drops.jsonl";
