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

export type IntentType = "self_status" | "inspect" | "observe" | "stop_observe" | "pause_observe" | "resume_observe" | "unknown";

export function classifyIntent(input: string): IntentType {
  if (!input || typeof input !== "string") return "unknown";
  const trimmed = input.trim();
  if (detectSelfStatusIntent(trimmed)) return "self_status";
  if (detectInspectIntent(trimmed)) return "inspect";
  if (detectStopObserveIntent(trimmed)) return "stop_observe";
  if (detectPauseObserveIntent(trimmed)) return "pause_observe";
  if (detectResumeObserveIntent(trimmed)) return "resume_observe";
  if (detectObserveIntent(trimmed)) return "observe";
  return "unknown";
}