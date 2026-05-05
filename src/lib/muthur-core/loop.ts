import type { MuthurLoopState, ToolLoopStep, ToolRegistry } from "./types";

export function createEmptyToolRegistry(): ToolRegistry {
  return { tools: {} };
}

function quoteSingle(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function looksLikeLocalPath(value: string): boolean {
  return /^[a-zA-Z]:\\/.test(value) || /^\\\\/.test(value) || /^\//.test(value);
}

function deriveLocalFsCall(intent: string) {
  const text = intent.trim();
  if (!text) return null;

  const explicitMatch = text.match(/^(?:\/local|local:)\s+(ls|cat|stat)\s+(.+)$/i);
  if (explicitMatch) {
    return {
      action: explicitMatch[1].toLowerCase(),
      path: explicitMatch[2].trim(),
      explicit: true,
    };
  }

  const directCommandMatch = text.match(/^(ls|cat|stat)\s+(.+)$/i);
  if (directCommandMatch && looksLikeLocalPath(directCommandMatch[2].trim())) {
    return {
      action: directCommandMatch[1].toLowerCase(),
      path: directCommandMatch[2].trim(),
      explicit: false,
    };
  }

  const listMatch = text.match(/^(?:list|show)\s+(?:the\s+)?(?:folder|directory|contents?)\s+(?:of|in)\s+(.+)$/i);
  if (listMatch && looksLikeLocalPath(listMatch[1].trim())) {
    return { action: "ls", path: listMatch[1].trim(), explicit: false };
  }

  const catMatch = text.match(/^(?:show|open|cat|print)\s+(?:me\s+)?(?:the\s+contents\s+of\s+)?(.+)$/i);
  if (catMatch && looksLikeLocalPath(catMatch[1].trim())) {
    return { action: "cat", path: catMatch[1].trim(), explicit: false };
  }

  const statMatch = text.match(/^(?:stat|inspect|what is)\s+(.+)$/i);
  if (statMatch && looksLikeLocalPath(statMatch[1].trim())) {
    return { action: "stat", path: statMatch[1].trim(), explicit: false };
  }

  return null;
}

function deriveJustBashCommand(intent: string): string | null {
  const text = intent.trim();
  if (!text) return null;

  if (/^(?:\/bash|bash:)\s+/i.test(text)) {
    return text.replace(/^(?:\/bash|bash:)\s+/i, "").trim() || null;
  }

  const lower = text.toLowerCase();

  if (/^(?:where am i|what folder|current directory|working directory)\??$/.test(lower)) {
    return "pwd";
  }

  const listMatch = text.match(/^(?:list|show)\s+(?:the\s+)?(?:(files|contents)\s+(?:of|in)\s+)?([./\w-]+)\??$/i);
  if (listMatch) {
    return `ls ${quoteSingle(listMatch[2])}`;
  }

  const catMatch = text.match(/^(?:show|open|cat|print)\s+(?:me\s+)?(?:the\s+contents\s+of\s+)?([./\w-]+\.[\w.-]+)\??$/i);
  if (catMatch) {
    return `cat ${quoteSingle(catMatch[1])}`;
  }

  const searchMatch = text.match(
    /^(?:search|find|grep|ripgrep|look for|where is|what files mention|which files mention|are there files that mention)\s+(?:for\s+)?["“]?([^"”]+?)["”]?(?:\s+(?:in|inside)\s+([./\w-]+))?\??$/i,
  );
  if (searchMatch) {
    const pattern = searchMatch[1].trim();
    const scope = (searchMatch[2] || "src").trim();
    if (pattern) {
      return `rg -i ${quoteSingle(pattern)} ${quoteSingle(scope)} -l`;
    }
  }

  return null;
}

function deriveClockCall(intent: string) {
  const text = intent.trim();
  const lower = text.toLowerCase();
  if (!lower) return null;

  if (/^(?:what(?:'s| is)? the time|what time is it|current time|time)\??$/.test(lower)) {
    return { mode: "time" };
  }

  if (/^(?:what(?:'s| is)? the date|what day is it|current date|date)\??$/.test(lower)) {
    return { mode: "date" };
  }

  if (/^(?:what(?:'s| is)? the date and time|what(?:'s| is)? the time and date|current date and time|current time and date|date and time)\??$/.test(lower)) {
    return { mode: "datetime" };
  }

  return null;
}

export function runMuthurCoreLoop(intent: string, _registry: ToolRegistry): MuthurLoopState {
  const normalizedIntent = (intent || "").trim();
  const steps: ToolLoopStep[] = [];

  const clockCall = deriveClockCall(normalizedIntent);
  if (clockCall) {
    const step: ToolLoopStep = {
      index: 0,
      intent: normalizedIntent,
      action: "tool",
      toolCall: {
        toolName: "clock",
        args: {
          mode: clockCall.mode,
        },
      },
      toolResult: null,
      note: "Phase 1: inferred local clock inspection.",
    };
    steps.push(step);

    return {
      intent: normalizedIntent,
      steps,
      finalized: false,
      finalResponse: "",
    };
  }

  const localFsCall = deriveLocalFsCall(normalizedIntent);
  if (localFsCall) {
    const step: ToolLoopStep = {
      index: 0,
      intent: normalizedIntent,
      action: "tool",
      toolCall: {
        toolName: "localfs",
        args: {
          action: localFsCall.action,
          path: localFsCall.path,
        },
      },
      toolResult: null,
      note: localFsCall.explicit
        ? "Phase 1: explicit local filesystem inspection."
        : "Phase 1: inferred local filesystem inspection.",
    };
    steps.push(step);

    return {
      intent: normalizedIntent,
      steps,
      finalized: false,
      finalResponse: "",
    };
  }

  const command = deriveJustBashCommand(normalizedIntent);
  if (command) {
    const step: ToolLoopStep = {
      index: 0,
      intent: normalizedIntent,
      action: "tool",
      toolCall: {
        toolName: "justbash",
        args: { command },
      },
      toolResult: null,
      note: /^(?:\/bash|bash:)\s+/i.test(normalizedIntent)
        ? "Phase 1: explicit just-bash tool invocation."
        : "Phase 1: inferred just-bash tool invocation for repo inspection.",
    };
    steps.push(step);

    return {
      intent: normalizedIntent,
      steps,
      finalized: false,
      finalResponse: "",
    };
  }

  const step: ToolLoopStep = {
    index: 0,
    intent: normalizedIntent,
    action: "respond",
    toolCall: null,
    toolResult: null,
    note: normalizedIntent ? "Phase 1: placeholder action selected." : "Phase 1: empty intent.",
  };
  steps.push(step);

  return {
    intent: normalizedIntent,
    steps,
    finalized: true,
    finalResponse: normalizedIntent,
  };
}
