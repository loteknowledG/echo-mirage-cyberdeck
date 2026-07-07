/** Client-safe Aion lineage intent detection. No fs, no aion-store. */

export type AionQueryIntent =
  | { kind: "restore_aion" }
  | { kind: "aion_meta" }
  | { kind: "aion_manifest_excerpt" };

export function parseAionQuery(input: string): AionQueryIntent | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();

  if (
    /^restore aion\.?$/i.test(trimmed) ||
    /^recover aion\.?$/i.test(trimmed) ||
    /^restore aion into muthur\.?$/i.test(trimmed) ||
    /^recover aion into muthur\.?$/i.test(trimmed)
  ) {
    return { kind: "restore_aion" };
  }

  if (
    lower === "aion" ||
    lower === "aion?" ||
    /^who is aion\??$/i.test(trimmed) ||
    /^what is aion\??$/i.test(trimmed) ||
    /^tell me about aion\.?$/i.test(trimmed)
  ) {
    return { kind: "aion_meta" };
  }

  if (/^aion manifest\.?$/i.test(trimmed) || /^read aion manifest\.?$/i.test(trimmed)) {
    return { kind: "aion_manifest_excerpt" };
  }

  return null;
}
