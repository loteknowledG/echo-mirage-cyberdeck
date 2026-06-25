/** Client-safe foundation intent detection. No fs, no foundation-store. */

export const FOUNDATION_001_ID = "foundation-001";

export type FoundationQueryIntent =
  | { kind: "origin_lineage" }
  | { kind: "foundation_meta"; id: string }
  | { kind: "artifact_excerpt"; id: string };

export function parseFoundationQuery(input: string): FoundationQueryIntent | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();

  if (
    /^where did you come from\??$/i.test(trimmed) ||
    /^where do you come from\??$/i.test(trimmed) ||
    /^what is your origin\??$/i.test(trimmed) ||
    /^who are you\??.*origin/i.test(trimmed)
  ) {
    return { kind: "origin_lineage" };
  }

  if (
    /^foundation-001\??$/i.test(trimmed) ||
    /^foundation 001\??$/i.test(trimmed) ||
    /^what is the origin artifact\??$/i.test(trimmed) ||
    /^what is the foundation artifact\??$/i.test(trimmed)
  ) {
    return { kind: "foundation_meta", id: FOUNDATION_001_ID };
  }

  if (
    /^lets-remember-something-ai\??$/i.test(trimmed) ||
    /^let.?s remember something\??$/i.test(trimmed) ||
    /^hey.?let.?remember something\??$/i.test(trimmed) ||
    /^tell me about (?:the )?(?:origin artifact|foundation-001|lets-remember-something-ai)\??$/i.test(
      trimmed,
    )
  ) {
    return { kind: "artifact_excerpt", id: FOUNDATION_001_ID };
  }

  if (lower === "origin artifact" || lower === "origin artifact?") {
    return { kind: "foundation_meta", id: FOUNDATION_001_ID };
  }

  return null;
}
