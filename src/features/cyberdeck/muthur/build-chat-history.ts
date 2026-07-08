export type CyberdeckChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export function buildCyberdeckChatHistory(
  messages: Array<{ role: string; text: string }>,
  limit = 8,
): CyberdeckChatHistoryMessage[] {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({
      role: message.role as CyberdeckChatHistoryMessage["role"],
      content: message.text.trim(),
    }))
    .filter((message) => Boolean(message.content))
    .slice(-limit);
}
