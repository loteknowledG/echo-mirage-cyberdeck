import type { MuthurInhabitant } from "@/lib/muthur/muthur-inhabitant";

export const CHAT_STORAGE_KEY = "echo-mirage-chat-messages-v1";
export const CHAT_STREAM_STORAGE_KEY = "echo-mirage-chat-stream-text-v1";
export const INPUT_HISTORY_KEY = "echo-mirage-chat-history-v1";

export type ChatMessage = {
  role: string;
  text: string;
  toolTrace?: string;
  inhabitant?: MuthurInhabitant;
};
