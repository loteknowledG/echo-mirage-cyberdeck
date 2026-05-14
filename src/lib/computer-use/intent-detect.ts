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

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9 ]/g, " ");
}

function isSelfStatusQuestion(text: string): boolean {
  const norm = normalize(text);
  return SELF_STATUS_PATTERNS.some((pattern) => norm.includes(normalize(pattern)));
}

export function detectSelfStatusIntent(input: string): boolean {
  if (!input || typeof input !== "string") return false;
  return isSelfStatusQuestion(input.trim());
}

export function classifyIntent(input: string): "self_status" | "unknown" {
  if (detectSelfStatusIntent(input)) {
    return "self_status";
  }
  return "unknown";
}