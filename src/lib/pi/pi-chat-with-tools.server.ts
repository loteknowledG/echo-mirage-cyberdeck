import {
  completeSimple,
  type Message,
  type Model,
  type SimpleStreamOptions,
} from "@mariozechner/pi-ai";
import {
  assistantMessageToText,
  executePiComputerUseChatTool,
  extractToolCalls,
  getPiComputerUseChatTools,
} from "@/lib/pi/pi-computer-use-chat-tools.server";

const MAX_PI_TOOL_ROUNDS = 12;

export async function runPiChatWithComputerUseTools(options: {
  model: Model<string>;
  systemPrompt?: string;
  messages: Message[];
  streamOptions: SimpleStreamOptions;
  write: (chunk: string) => void;
}): Promise<void> {
  const { model, streamOptions, write } = options;
  const messages: Message[] = [...options.messages];
  const tools = getPiComputerUseChatTools();

  write("⏳ Pi // uplink active...\n\n");

  for (let round = 0; round < MAX_PI_TOOL_ROUNDS; round++) {
    const assistant = await completeSimple(
      model,
      {
        systemPrompt: options.systemPrompt,
        messages,
        tools,
      },
      streamOptions,
    );

    const text = assistantMessageToText(assistant.content);
    if (text.trim()) {
      write(text);
      if (!text.endsWith("\n")) write("\n");
    }

    if (assistant.stopReason !== "toolUse") {
      return;
    }

    const toolCalls = extractToolCalls(assistant.content);
    if (toolCalls.length === 0) {
      return;
    }

    messages.push(assistant);

    for (const toolCall of toolCalls) {
      write(`\n⏳ Pi // tool: ${toolCall.name} (${String(toolCall.arguments?.action ?? "…")})\n`);
      const result = await executePiComputerUseChatTool(toolCall);
      write(`${result.isError ? "✗" : "✓"} ${toolCall.name}\n`);

      messages.push({
        role: "toolResult",
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [{ type: "text", text: result.text }],
        isError: result.isError,
        timestamp: Date.now(),
      });
    }
  }

  write("\n[Pi] Reached maximum tool rounds for this turn.\n");
}
