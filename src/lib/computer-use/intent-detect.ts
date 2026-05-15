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

export function detectSelfStatusIntent(input: string): boolean {
  if (!input || typeof input !== "string") return false;
  return isSelfStatusQuestion(input.trim());
}

export function detectInspectIntent(input: string): boolean {
  if (!input || typeof input !== "string") return false;
  return isInspectRequest(input.trim());
}

export function classifyIntent(input: string): "self_status" | "inspect" | "unknown" {
  if (!input || typeof input !== "string") return "unknown";
  const trimmed = input.trim();
  if (detectSelfStatusIntent(trimmed)) return "self_status";
  if (detectInspectIntent(trimmed)) return "inspect";
  return "unknown";
}