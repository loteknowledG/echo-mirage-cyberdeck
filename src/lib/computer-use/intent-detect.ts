const SELF_STATUS_PATTERNS = [
  "what computer-use capabilities",
  "what capabilities do you have",
  "what actions can you do",
  "what computer use actions",
  "what computer use",
  "computer use status",
  "computer-use status",
  "current capabilities",
  "supported actions",
  "unsupported actions",
  "what can you do on the computer",
  "computer use lease",
  "lease ownership",
  "ownership state",
  "who is in control",
  "muthur mode",
  "muthur indicate",
  "pointer availability",
  "confirmation requirements",
  "what requires confirmation",
  "get computer use status",
  "introspect computer use",
  "what are your capabilities",
  "what is your computer",
];

const INSPECT_PATTERNS = [
  "inspect current screen",
  "inspect the screen",
  "inspect screen",
  "inspect my screen",
  "look at my screen",
  "look at the screen",
  "check my screen",
  "what's on my screen",
  "what is on my screen",
  "what do you see on screen",
  "what do you see",
  "take a screenshot",
  "capture screen",
  "share my screen",
  "show me what's open",
  "what applications are open",
  "what app is active",
  "muthur inspect",
];

const OBSERVE_PATTERNS = [
  "observe this workflow",
  "start workflow observation",
  "start observing",
  "observe workflow",
  "start workflow recording",
  "record this workflow",
];

const STOP_OBSERVE_PATTERNS = [
  "stop workflow observation",
  "stop observing",
  "end workflow observation",
  "stop workflow recording",
  "finish observation",
  "stop recording this workflow",
  "done observing",
];

const PAUSE_OBSERVE_PATTERNS = [
  "pause workflow observation",
  "pause observing",
  "pause workflow recording",
];

const RESUME_OBSERVE_PATTERNS = [
  "resume workflow observation",
  "resume observing",
  "resume workflow recording",
];

const EXEC_DECK_SHOW_PATTERNS = [
  "show execution deck",
  "open execution deck",
  "execution deck",
  "what is on the execution deck",
  "whats on the execution deck",
  "execution deck status",
  "show me the execution deck",
  "muthur show execution deck",
];

const EXEC_DECK_PREPARE_PATTERNS = [
  "prepare reviewer hand",
  "prepare hand",
  "stage reviewer hand",
  "load reviewer hand",
  "muthur prepare reviewer hand",
  "prepare the reviewer hand",
];

const EXEC_DECK_CLEAR_PATTERNS = [
  "clear execution deck",
  "discard execution deck",
  "clear the deck",
  "empty execution deck",
  "muthur clear execution deck",
  "reset execution deck",
];

const EXEC_DECK_PUSH_PATTERNS = [
  "push hand to stack",
  "push to stack",
  "commit hand",
  "stage stack",
  "muthur push hand to stack",
  "muthur push to stack",
];

const EXEC_DECK_EXECUTE_PATTERNS = [
  "execute deck",
  "run deck",
  "execute stack",
  "run stack",
  "execute next card",
  "muthur execute deck",
  "muthur execute",
  "run execution deck",
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9 ]/g, " ");
}

function isSelfStatusQuestion(text: string): boolean {
  const norm = normalize(text);
  return SELF_STATUS_PATTERNS.some((pattern) => norm.includes(normalize(pattern)));
}

function isInspectRequest(text: string): boolean {
  const norm = normalize(text);
  return INSPECT_PATTERNS.some((pattern) => norm.includes(normalize(pattern)));
}

function isObserveRequest(text: string): boolean {
  const norm = normalize(text);
  return OBSERVE_PATTERNS.some((pattern) => norm.includes(normalize(pattern)));
}

function isStopObserveRequest(text: string): boolean {
  const norm = normalize(text);
  return STOP_OBSERVE_PATTERNS.some((pattern) => norm.includes(normalize(pattern)));
}

function isPauseObserveRequest(text: string): boolean {
  const norm = normalize(text);
  return PAUSE_OBSERVE_PATTERNS.some((pattern) => norm.includes(normalize(pattern)));
}

function isResumeObserveRequest(text: string): boolean {
  const norm = normalize(text);
  return RESUME_OBSERVE_PATTERNS.some((pattern) => norm.includes(normalize(pattern)));
}

export function detectSelfStatusIntent(input: string): boolean {
  if (!input || typeof input !== "string") return false;
  return isSelfStatusQuestion(input.trim());
}

export function detectInspectIntent(input: string): boolean {
  if (!input || typeof input !== "string") return false;
  return isInspectRequest(input.trim());
}

export function detectObserveIntent(input: string): boolean {
  if (!input || typeof input !== "string") return false;
  return isObserveRequest(input.trim());
}

export function detectStopObserveIntent(input: string): boolean {
  if (!input || typeof input !== "string") return false;
  return isStopObserveRequest(input.trim());
}

export function detectPauseObserveIntent(input: string): boolean {
  if (!input || typeof input !== "string") return false;
  return isPauseObserveRequest(input.trim());
}

export function detectResumeObserveIntent(input: string): boolean {
  if (!input || typeof input !== "string") return false;
  return isResumeObserveRequest(input.trim());
}

export function detectExecDeckShowIntent(input: string): boolean {
  if (!input || typeof input !== "string") return false;
  const norm = normalize(input.trim());
  return EXEC_DECK_SHOW_PATTERNS.some((p) => norm.includes(normalize(p)));
}

export function detectExecDeckPrepareIntent(input: string): boolean {
  if (!input || typeof input !== "string") return false;
  const norm = normalize(input.trim());
  return EXEC_DECK_PREPARE_PATTERNS.some((p) => norm.includes(normalize(p)));
}

export function detectExecDeckClearIntent(input: string): boolean {
  if (!input || typeof input !== "string") return false;
  const norm = normalize(input.trim());
  return EXEC_DECK_CLEAR_PATTERNS.some((p) => norm.includes(normalize(p)));
}

export function detectExecDeckPushIntent(input: string): boolean {
  if (!input || typeof input !== "string") return false;
  const norm = normalize(input.trim());
  return EXEC_DECK_PUSH_PATTERNS.some((p) => norm.includes(normalize(p)));
}

export function detectExecDeckExecuteIntent(input: string): boolean {
  if (!input || typeof input !== "string") return false;
  const norm = normalize(input.trim());
  return EXEC_DECK_EXECUTE_PATTERNS.some((p) => norm.includes(normalize(p)));
}

export type IntentType = "self_status" | "inspect" | "observe" | "stop_observe" | "pause_observe" | "resume_observe" | "exec_deck_show" | "exec_deck_prepare" | "exec_deck_clear" | "exec_deck_push" | "exec_deck_execute" | "unknown";

export function classifyIntent(input: string): IntentType {
  if (!input || typeof input !== "string") return "unknown";
  const trimmed = input.trim();
  if (detectSelfStatusIntent(trimmed)) return "self_status";
  if (detectInspectIntent(trimmed)) return "inspect";
  if (detectStopObserveIntent(trimmed)) return "stop_observe";
  if (detectPauseObserveIntent(trimmed)) return "pause_observe";
  if (detectResumeObserveIntent(trimmed)) return "resume_observe";
  if (detectExecDeckShowIntent(trimmed)) return "exec_deck_show";
  if (detectExecDeckPrepareIntent(trimmed)) return "exec_deck_prepare";
  if (detectExecDeckPushIntent(trimmed)) return "exec_deck_push";
  if (detectExecDeckExecuteIntent(trimmed)) return "exec_deck_execute";
  if (detectExecDeckClearIntent(trimmed)) return "exec_deck_clear";
  if (detectObserveIntent(trimmed)) return "observe";
  return "unknown";
}