const SURVEY_LINK_VERB = "(?:connect|pair|wire|link)";
const SURVEY_NODE = "(?:echo|mirage|powerfist)";
const SURVEY_NODE_JOIN = "(?:\\s+(?:to|with|and|,|↔)\\s+|\\s*,\\s*)";

function stripMuthurPrefix(input: string): string {
  return input.replace(/^muthur\s*,?\s*/i, "").trim();
}

function normalizeSurveyConnectMessage(input: string): string {
  return stripMuthurPrefix(input)
    .replace(/\becho\s+d\s+mirage\b/gi, "echo and mirage")
    .replace(/\bmirage\s+d\s+powerfist\b/gi, "mirage and powerfist")
    .replace(/\b(?:and|to|with)\s+d\s+/gi, " and ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Local chat commands — wire Survey TEAM LINKS without opening the Survey tab. */
export function parseSurveyAutoConnectIntent(input: string): boolean {
  const trimmed = normalizeSurveyConnectMessage(input.trim());
  if (!trimmed) return false;

  if (
    /^(?:\/survey\s+(?:auto\s*)?connect|survey\s+auto\s*connect|auto\s*connect\s+survey)$/i.test(
      trimmed,
    )
  ) {
    return true;
  }

  if (
    new RegExp(`^${SURVEY_LINK_VERB}\\s+(?:the\\s+)?(?:survey\\s+)?team(?:\\s+links?)?$`, "i").test(
      trimmed,
    )
  ) {
    return true;
  }

  if (
    new RegExp(
      `^${SURVEY_LINK_VERB}\\s+${SURVEY_NODE}(?:${SURVEY_NODE_JOIN}${SURVEY_NODE})*\\s*(?:for\\s+)?survey$`,
      "i",
    ).test(trimmed)
  ) {
    return true;
  }

  // connect mirage to powerfist · link echo and mirage · pair powerfist with echo
  if (
    new RegExp(
      `^${SURVEY_LINK_VERB}\\s+${SURVEY_NODE}(?:${SURVEY_NODE_JOIN}${SURVEY_NODE})+$`,
      "i",
    ).test(trimmed)
  ) {
    return true;
  }

  if (
    new RegExp(
      `^${SURVEY_LINK_VERB}\\s+(?:them|the\\s+squad|the\\s+team|survey|all(?:\\s+three|\\s+3)?)$`,
      "i",
    ).test(trimmed)
  ) {
    return true;
  }

  if (/^triple[\s-]?link(?:\s+(?:survey|team|squad|them))?$/i.test(trimmed)) {
    return true;
  }

  if (/^(?:squad|team)\s+link(?:\s+survey)?$/i.test(trimmed)) {
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
