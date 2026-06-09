export const CHAT_USER_DISPLAY_NAME_KEY = "echo-mirage-chat-user-display-name-v1";
export const DEFAULT_CHAT_USER_DISPLAY_NAME = "USR";
const CHAT_USER_DISPLAY_NAME_MAX = 16;

export function normalizeChatUserDisplayName(raw: string): string {
  const trimmed = raw.replace(/[\[\]]/g, "").trim();
  if (!trimmed) return DEFAULT_CHAT_USER_DISPLAY_NAME;
  return trimmed.slice(0, CHAT_USER_DISPLAY_NAME_MAX).toUpperCase();
}

export function readChatUserDisplayName(): string {
  if (typeof window === "undefined") return DEFAULT_CHAT_USER_DISPLAY_NAME;
  try {
    const stored = window.localStorage.getItem(CHAT_USER_DISPLAY_NAME_KEY);
    if (typeof stored === "string" && stored.trim()) {
      return normalizeChatUserDisplayName(stored);
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_CHAT_USER_DISPLAY_NAME;
}

export function writeChatUserDisplayName(name: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAT_USER_DISPLAY_NAME_KEY, normalizeChatUserDisplayName(name));
  } catch {
    /* ignore */
  }
}
