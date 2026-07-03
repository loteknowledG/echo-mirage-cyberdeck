/** Local chat commands — wire Survey TEAM LINKS without opening the Survey tab. */
export function parseSurveyAutoConnectIntent(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;

  if (
    /^(?:\/survey\s+(?:auto\s*)?connect|survey\s+auto\s*connect|auto\s*connect\s+survey)$/i.test(
      trimmed,
    )
  ) {
    return true;
  }

  if (
    /^(?:connect|pair|wire|link)\s+(?:the\s+)?(?:survey\s+)?team(?:\s+links)?$/i.test(trimmed)
  ) {
    return true;
  }

  if (
    /^(?:connect|pair|wire|link)\s+(?:echo|mirage|powerfist)(?:\s*,\s*(?:echo|mirage|powerfist))*\s*(?:for\s+)?survey$/i.test(
      trimmed,
    )
  ) {
    return true;
  }

  if (/(?:zero[\s-]?click|auto[\s-]?connect).*(?:survey|team\s+links?)/i.test(trimmed)) {
    return true;
  }

  if (/(?:survey|team\s+links?).*(?:zero[\s-]?click|auto[\s-]?connect)/i.test(trimmed)) {
    return true;
  }

  return false;
}
