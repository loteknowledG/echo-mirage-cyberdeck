type OpenAiMessageContentPart = {
  type?: string;
  text?: string;
};

type OpenAiCompletionMessage = {
  content?: string | OpenAiMessageContentPart[] | null;
  reasoning_content?: string | null;
  reasoning?: string | null;
};

/** Normalize OpenAI-compatible message.content (string, array parts, or reasoning fields). */
export function extractOpenAiMessageText(message: OpenAiCompletionMessage | null | undefined): string {
  if (!message) return "";

  if (typeof message.content === "string") {
    return message.content;
  }

  if (Array.isArray(message.content)) {
    const parts = message.content
      .map((part) => {
        if (!part) return "";
        if (typeof part === "string") return part;
        if (typeof part.text === "string") return part.text;
        return "";
      })
      .filter(Boolean);
    const joined = parts.join("\n").trim();
    if (joined) return joined;
  }

  if (typeof message.reasoning_content === "string" && message.reasoning_content.trim()) {
    return message.reasoning_content;
  }

  if (typeof message.reasoning === "string" && message.reasoning.trim()) {
    return message.reasoning;
  }

  return "";
}

/** Visible assistant content only — never folds in reasoning tokens. */
export function extractOpenAiAssistantVisibleContent(
  message: OpenAiCompletionMessage | null | undefined,
): string {
  if (!message) return "";

  if (typeof message.content === "string") {
    return message.content;
  }

  if (Array.isArray(message.content)) {
    const parts = message.content
      .map((part) => {
        if (!part) return "";
        if (typeof part === "string") return part;
        if (typeof part.text === "string") return part.text;
        return "";
      })
      .filter(Boolean);
    return parts.join("\n").trim();
  }

  return "";
}

export function extractOpenAiMessageReasoning(
  message: OpenAiCompletionMessage | null | undefined,
): string {
  if (!message) return "";
  if (typeof message.reasoning_content === "string" && message.reasoning_content.trim()) {
    return message.reasoning_content.trim();
  }
  if (typeof message.reasoning === "string" && message.reasoning.trim()) {
    return message.reasoning.trim();
  }
  return "";
}
