export type CanonicalTarget =
  | "COMMAND_INPUT"
  | "VOICE_LAB"
  | "LEFT_CONSOLE"
  | "RIGHT_PANEL"
  | "CENTER_STAGE";

export interface ResolveResult {
  success: true;
  target: CanonicalTarget;
}

export interface UnresolvedResult {
  success: false;
  reason: "alias-not-found";
  query: string;
}

export type ResolveTargetResult = ResolveResult | UnresolvedResult;

const ALIAS_MAP: Record<CanonicalTarget, readonly string[]> = {
  COMMAND_INPUT: [
    "command input",
    "command input area",
    "message box",
    "chat box",
    "text box",
    "textbox",
    "prompt",
    "prompt field",
    "input field",
    "input area",
    "message input",
    "command box",
  ],
  VOICE_LAB: [
    "voice lab",
    "voice panel",
    "voice controls",
    "audio panel",
    "tts panel",
    "speech controls",
    "master gain",
  ],
  LEFT_CONSOLE: [
    "left console",
    "left panel",
    "log panel",
    "system log",
    "sys log",
  ],
  RIGHT_PANEL: [
    "right panel",
    "document panel",
    "docs panel",
    "viewer panel",
    "markdown panel",
  ],
  CENTER_STAGE: [
    "center stage",
    "main content",
    "central area",
    "main panel",
  ],
};

function normalize(input: string): string {
  return input.toLowerCase().replace(/\s+/g, " ").trim();
}

function buildExactMap(): Map<string, CanonicalTarget> {
  const map = new Map<string, CanonicalTarget>();
  for (const [target, aliases] of Object.entries(ALIAS_MAP)) {
    for (const alias of aliases) {
      map.set(normalize(alias), target as CanonicalTarget);
    }
  }
  return map;
}

const EXACT_MAP = buildExactMap();

export function resolveUiTarget(input: string): ResolveTargetResult {
  const normalized = normalize(input);

  const exact = EXACT_MAP.get(normalized);
  if (exact) {
    return { success: true, target: exact };
  }

  const matches: CanonicalTarget[] = [];
  for (const [target, aliases] of Object.entries(ALIAS_MAP)) {
    for (const alias of aliases) {
      if (normalized.includes(normalize(alias))) {
        matches.push(target as CanonicalTarget);
        break;
      }
    }
  }

  if (matches.length === 1) {
    return { success: true, target: matches[0] };
  }

  return { success: false, reason: "alias-not-found", query: input };
}